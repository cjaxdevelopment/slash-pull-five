import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { postgresOptions } from './postgres.js';

export interface Executor {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
}
export interface Database extends Executor {
  transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export function embeddedDatabase(engine: PGlite): Database {
  // PGlite serializes its transactions. Query through the supplied transaction, never through the outer database inside a transaction.
  const executor = (client: Pick<PGlite, 'query'>): Executor => ({
    query: async <T>(sql: string, params: unknown[] = []) => {
      const result = await client.query<T>(sql, params);
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
    },
  });
  return {
    ...executor(engine),
    transaction: (fn) => engine.transaction((tx) => fn(executor(tx))),
    close: () => engine.close(),
  };
}
export async function openDatabase(): Promise<Database> {
  if (process.env.DATABASE_MODE !== 'postgres') {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Production requires DATABASE_MODE=postgres and DATABASE_URL.');
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const directory = process.env.DATABASE_DIRECTORY
      ? resolve(root, process.env.DATABASE_DIRECTORY)
      : resolve(root, '.local/postgres');
    await mkdir(directory, { recursive: true });
    return embeddedDatabase(new PGlite(directory));
  }
  const pool = new Pool(await postgresOptions());
  const wrap = (client: Pick<Pool, 'query'>): Executor => ({
    query: async <T>(sql: string, params: unknown[] = []) => {
      const r = await client.query(sql, params);
      return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
    },
  });
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    await pool.end();
    throw error;
  }
  return {
    ...wrap(pool),
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(wrap(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
export async function migrate(db: Database) {
  const directory = new URL('../migrations/', import.meta.url);
  const files = await Promise.all(
    (await readdir(directory))
      .filter((n) => n.endsWith('.sql'))
      .sort()
      .map(async (name) => {
        const sql = await readFile(new URL(name, directory), 'utf8');
        const normalized = sql.replaceAll('\r\n', '\n');
        return {
          name,
          sql: normalized,
          checksum: createHash('sha256').update(normalized).digest('hex'),
          windowsChecksum: createHash('sha256')
            .update(normalized.replaceAll('\n', '\r\n'))
            .digest('hex'),
        };
      }),
  );
  await db.transaction(async (tx) => {
    // Serialize release/startup migrations, including first-time creation of the migration table.
    await tx.query('SELECT pg_advisory_xact_lock(746592831)');
    await tx.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    for (const { name, sql, checksum, windowsChecksum } of files) {
      const applied = await tx.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE name=$1',
        [name],
      );
      if (applied.rows[0]) {
        if (![checksum, windowsChecksum].includes(applied.rows[0].checksum))
          throw new Error('Applied migration changed: ' + name);
        if (applied.rows[0].checksum !== checksum)
          await tx.query('UPDATE schema_migrations SET checksum=$1 WHERE name=$2', [
            checksum,
            name,
          ]);
        continue;
      }
      // Migration statements do not contain semicolons in strings or procedural blocks.
      for (const statement of sql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await tx.query(statement);
      await tx.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [
        name,
        checksum,
      ]);
    }
  });
}
