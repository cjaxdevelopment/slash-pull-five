import { randomUUID } from 'node:crypto';
import {
  catalog,
  characterSchema,
  csvHeaders,
  parseCsv,
  races,
  type CharacterInput,
  type Snapshot,
  type Workspace,
  type Character,
  type Plan,
  type Assignment,
} from '@spf/shared';
import type { Executor } from './database.js';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const characterColumns = `id,trim(first_name||' '||last_name) AS name,class,spec,preferred_role AS role,buffs,archived,updated_at AS "updatedAt",revision`;
export async function activity(tx: Executor, guild: string, user: string, action: string) {
  await tx.query('INSERT INTO activity(id,guild_id,actor_id,action) VALUES($1,$2,$3,$4)', [
    randomUUID(),
    guild,
    user,
    action,
  ]);
}
export async function insertCharacter(tx: Executor, guild: Workspace, c: CharacterInput) {
  const id = randomUUID();
  const race = Object.entries(races[guild.faction]).find(([, allowed]) =>
    allowed.includes(c.class),
  )?.[0];
  await tx.query(
    `INSERT INTO characters(id,guild_id,first_name,last_name,region,class,race,faction,ruleset,level,preferred_role,spec,buffs)
    VALUES($1,$2,$3,'',$4,$5,$6,$7,$8,60,$9,$10,$11)`,
    [
      id,
      guild.id,
      c.name,
      guild.region,
      c.class,
      race,
      guild.faction,
      guild.ruleset,
      c.role,
      c.spec,
      JSON.stringify(c.buffs),
    ],
  );
  return id;
}
export async function snapshot(tx: Executor, guild: Workspace): Promise<Snapshot> {
  const characters = (
    await tx.query<Character>(
      `SELECT ${characterColumns} FROM characters WHERE guild_id=$1 ORDER BY lower(first_name),lower(last_name)`,
      [guild.id],
    )
  ).rows;
  const plans = (
    await tx.query<Omit<Plan, 'assignments'>>(
      'SELECT id,name,capacity,notes,revision,updated_at AS "updatedAt" FROM plans WHERE guild_id=$1 ORDER BY updated_at DESC',
      [guild.id],
    )
  ).rows;
  const assignments = (
    await tx.query<Assignment & { planId: string }>(
      'SELECT id,plan_id AS "planId",character_id AS "characterId",status,group_number AS "group",slot FROM assignments WHERE guild_id=$1 ORDER BY group_number NULLS LAST,slot NULLS LAST,id',
      [guild.id],
    )
  ).rows;
  return {
    workspace: guild,
    characters,
    plans: plans.map((p) => ({
      ...p,
      assignments: assignments.filter((a) => a.planId === p.id).map(({ planId: _, ...a }) => a),
    })),
  };
}
export async function importCsv(tx: Executor, guild: Workspace, csv: string) {
  let rows: string[][];
  try {
    rows = parseCsv(csv.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new HttpError(400, (error as Error).message);
  }
  if (rows.length < 2 || rows.length > 501)
    throw new HttpError(400, 'Import between 1 and 500 characters at a time.');
  if (rows[0].join(',') !== csvHeaders.join(','))
    throw new HttpError(400, `Expected CSV headers: ${csvHeaders.join(',')}`);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length !== csvHeaders.length)
      throw new HttpError(400, `Row ${i + 1}: expected ${csvHeaders.length} columns.`);
    const [name, playerClass, spec, role, rawBuffs] = rows[i].map((v) => v.trim());
    let selected: unknown;
    try {
      selected = JSON.parse(rawBuffs || '[]');
    } catch {
      throw new HttpError(400, `Row ${i + 1}: buffs must be a JSON array of buff IDs.`);
    }
    const result = characterSchema.safeParse({
      name,
      class: playerClass,
      spec: spec || 'custom',
      role,
      buffs: selected,
    });
    if (!result.success)
      throw new HttpError(
        400,
        `Row ${i + 1}: ${result.error.issues.map((e) => e.message).join(' ')}`,
      );
    await insertCharacter(tx, guild, result.data);
  }
  return { charactersCreated: rows.length - 1, catalogVersion: catalog.version };
}
