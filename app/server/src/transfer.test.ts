import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { embeddedDatabase, migrate } from './database.js';
import { createPrivateAccount, verifyPassword } from './auth.js';
import { exportDatabase, restoreDatabase, type DatabaseTransfer } from './transfer.js';
import { insertCharacter } from './roster.js';
let snapshot: DatabaseTransfer;
const source = embeddedDatabase(new PGlite());
beforeAll(async () => {
  await migrate(source);
  const settings = {
    name: 'Private raids',
    region: 'us',
    faction: 'alliance',
    ruleset: 'normal',
  } as const;
  const account = await createPrivateAccount(source, 'ct', 'transfer-test-password', settings);
  const c = await insertCharacter(
    source,
    { ...settings, id: account.guildId, role: 'owner' },
    {
      name: 'Moon',
      class: 'druid',
      spec: 'balance',
      role: 'ranged',
      buffs: ['moonkin_aura', 'mark_of_the_wild'],
    },
  );
  const plan = randomUUID();
  await source.query(
    "INSERT INTO plans(id,guild_id,name,encounter,capacity,targets,catalog_version) VALUES($1,$2,'Raid','custom',20,'{}','test')",
    [plan, account.guildId],
  );
  await source.query(
    "INSERT INTO assignments(id,guild_id,plan_id,character_id,role,status,group_number,slot) VALUES($1,$2,$3,$4,'ranged','lineup',2,4)",
    [randomUUID(), account.guildId, plan, c],
  );
  await source.query(
    "INSERT INTO activity(id,guild_id,actor_id,action) VALUES($1,$2,$3,'Created raid')",
    [randomUUID(), account.guildId, account.userId],
  );
  await source.query(
    "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES('secret-session',$1,'secret-csrf',now()+interval '1 hour')",
    [account.userId],
  );
  await source.query(
    "INSERT INTO profs_scopes(id,game_version,region,profile_namespace,data_namespace,guild_name,guild_realm) VALUES('retail:us','retail','us','profile-us','static-us','Fixture guild','fixture-realm')",
  );
  const professionCharacter = randomUUID();
  await source.query(
    "INSERT INTO profs_characters(id,scope_id,api_id,name,realm,snapshot) VALUES($1,'retail:us',1,'TransferFixture','fixture-realm','{\"tiers\":[]}'::jsonb)",
    [professionCharacter],
  );
  await source.query(
    'INSERT INTO profs_recipes(scope_id,api_id,name,items) VALUES(\'retail:us\',90,\'Fixture recipe\',\'[{"id":700,"name":"Fixture item"}]\'::jsonb)',
  );
  await source.query(
    "INSERT INTO profs_known_recipes(character_id,scope_id,recipe_id,profession,expansion) VALUES($1,'retail:us',90,'Fixture profession','Fixture expansion')",
    [professionCharacter],
  );
  await source.query(
    "INSERT INTO profs_claims(id,scope_id,character_id,user_id,status) VALUES($1,'retail:us',$2,$3,'approved')",
    [randomUUID(), professionCharacter, account.userId],
  );
  await source.query(
    "INSERT INTO profs_members(scope_id,user_id,discord,main_character_id) VALUES('retail:us',$1,'Fixture contact',$2)",
    [account.userId, professionCharacter],
  );
  snapshot = await exportDatabase(source);
});
afterAll(async () => source.close());
it('transfers private accounts, password hashes and exact raid placements without login sessions', async () => {
  const target = embeddedDatabase(new PGlite());
  try {
    await migrate(target);
    await restoreDatabase(target, JSON.parse(JSON.stringify(snapshot)));
    const restored = await exportDatabase(target);
    expect(restored.data).toEqual(snapshot.data);
    const user = restored.data.users[0];
    expect(await verifyPassword('transfer-test-password', String(user.password_hash))).toBe(true);
    expect(restored.data.assignments[0]).toMatchObject({ group_number: 2, slot: 4 });
    expect((await target.query('SELECT * FROM sessions')).rows).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain('secret-session');
    await expect(restoreDatabase(target, snapshot)).rejects.toThrow('not empty');
    expect((await exportDatabase(target)).data).toEqual(snapshot.data);
  } finally {
    await target.close();
  }
});
it('rolls back the entire transfer for invalid fields or schema mismatches', async () => {
  const target = embeddedDatabase(new PGlite());
  try {
    await migrate(target);
    const broken = structuredClone(snapshot);
    broken.data.characters[0].foreign_field = 'invalid';
    await expect(restoreDatabase(target, broken)).rejects.toThrow('Invalid columns');
    expect((await target.query('SELECT * FROM users')).rows).toEqual([]);
    const outdated = structuredClone(snapshot);
    outdated.migrations.pop();
    await expect(restoreDatabase(target, outdated)).rejects.toThrow('migrations differ');
    expect((await target.query('SELECT * FROM users')).rows).toEqual([]);
  } finally {
    await target.close();
  }
});
