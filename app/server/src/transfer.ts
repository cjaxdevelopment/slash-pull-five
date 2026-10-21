import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Database, Executor } from './database.js';

const tables = [
  'users',
  'guilds',
  'guild_access',
  'roster_members',
  'characters',
  'plans',
  'assignments',
  'activity',
  'profs_scopes',
  'profs_characters',
  'profs_recipes',
  'profs_known_recipes',
  'profs_claims',
  'profs_members',
  'profs_jobs',
] as const;
type Table = (typeof tables)[number];
type Row = Record<string, unknown>;
type Column = { column_name: string; data_type: string };
const transferSchema = z
  .object({
    version: z.literal(1),
    exportedAt: z.string().max(40),
    migrations: z
      .array(
        z
          .object({ name: z.string().max(100), checksum: z.string().regex(/^[a-f0-9]{64}$/) })
          .strict(),
      )
      .max(100),
    data: z.record(z.enum(tables), z.array(z.record(z.string(), z.unknown())).max(100000)),
  })
  .strict();
export type DatabaseTransfer = z.infer<typeof transferSchema>;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
const digest = (rows: Row[]) =>
  createHash('sha256')
    .update(
      JSON.stringify(
        rows
          .map(canonical)
          .sort((a, b) =>
            JSON.stringify(a) < JSON.stringify(b)
              ? -1
              : JSON.stringify(a) > JSON.stringify(b)
                ? 1
                : 0,
          ),
      ),
    )
    .digest('hex');
async function columns(tx: Executor, table: Table) {
  return (
    await tx.query<Column>(
      'SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position',
      [table],
    )
  ).rows;
}
function normalize(rows: Row[], schema: Column[]): Row[] {
  return rows.map((row) =>
    Object.fromEntries(
      schema.map((column) => [
        column.column_name,
        row[column.column_name] != null && column.data_type.startsWith('timestamp')
          ? new Date(String(row[column.column_name])).toISOString()
          : row[column.column_name],
      ]),
    ),
  );
}
const migrations = async (tx: Executor) =>
  (
    await tx.query<{ name: string; checksum: string }>(
      'SELECT name,checksum FROM schema_migrations ORDER BY name',
    )
  ).rows;

// Administrator-only database transfer. Sessions and invitations are intentionally excluded.
export async function exportDatabase(db: Database): Promise<DatabaseTransfer> {
  return db.transaction(async (tx) => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const data = {} as Record<Table, Row[]>;
    for (const table of tables)
      data[table] = normalize(
        (await tx.query<Row>('SELECT * FROM ' + table)).rows,
        await columns(tx, table),
      );
    return transferSchema.parse({
      version: 1,
      exportedAt: new Date().toISOString(),
      migrations: await migrations(tx),
      data,
    });
  });
}
export async function restoreDatabase(db: Database, input: unknown) {
  const snapshot = transferSchema.parse(input);
  return db.transaction(async (tx) => {
    await tx.query('LOCK TABLE ' + tables.join(',') + ' IN EXCLUSIVE MODE');
    if (JSON.stringify(await migrations(tx)) !== JSON.stringify(snapshot.migrations))
      throw new Error(
        'Source and destination migrations differ. Use the same application revision.',
      );
    for (const table of [...tables, 'sessions', 'invitations']) {
      const count = (
        await tx.query<{ count: number }>('SELECT count(*)::int AS count FROM ' + table)
      ).rows[0].count;
      if (count)
        throw new Error('Destination database is not empty. Existing data was not replaced.');
    }
    const counts = {} as Record<Table, number>;
    for (const table of tables) {
      const schema = await columns(tx, table);
      const names = schema.map((column) => column.column_name);
      const expected = [...names].sort().join(',');
      const sql =
        'INSERT INTO ' +
        table +
        '(' +
        names.map((name) => '"' + name + '"').join(',') +
        ') VALUES(' +
        names.map((_, i) => '$' + (i + 1)).join(',') +
        ')';
      for (const row of snapshot.data[table]) {
        if (Object.keys(row).sort().join(',') !== expected)
          throw new Error('Invalid columns in transfer for ' + table + '.');
        await tx.query(
          sql,
          schema.map((column) =>
            column.data_type === 'jsonb' || column.data_type === 'json'
              ? JSON.stringify(row[column.column_name])
              : row[column.column_name],
          ),
        );
      }
      const restored = normalize((await tx.query<Row>('SELECT * FROM ' + table)).rows, schema);
      if (digest(restored) !== digest(normalize(snapshot.data[table], schema)))
        throw new Error('Transfer verification failed for ' + table + '.');
      counts[table] = restored.length;
    }
    return counts;
  });
}
