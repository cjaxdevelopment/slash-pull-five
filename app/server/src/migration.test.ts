import { readFile, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import request from 'supertest';
import { embeddedDatabase, migrate } from './database.js';
import { bootstrap, hashPassword } from './auth.js';
import { createApp } from './app.js';
it('adds Forever identities while retaining the retail proof-of-concept snapshots', async () => {
  const engine = new PGlite();
  const db = embeddedDatabase(engine);
  try {
    await db.query(
      'CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const directory = new URL('../migrations/', import.meta.url);
    for (const name of (await readdir(directory))
      .filter((n) => n.endsWith('.sql') && n < '011_')
      .sort()) {
      const sql = (await readFile(new URL(name, directory), 'utf8')).replaceAll('\r\n', '\n');
      await engine.exec(sql);
      await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [
        name,
        createHash('sha256').update(sql).digest('hex'),
      ]);
    }
    await db.query(
      "INSERT INTO profs_scopes(id,game_version,region,profile_namespace,data_namespace,guild_name,guild_realm) VALUES('retail:us','retail','us','profile-us','static-us','Rewound','area-52')",
    );
    const id = randomUUID();
    await db.query(
      "INSERT INTO profs_characters(id,scope_id,api_id,name,realm,snapshot,in_roster) VALUES($1,'retail:us',1,'Legacy','area-52','{\"tiers\":[]}',true)",
      [id],
    );
    const before = (await db.query('SELECT * FROM profs_characters WHERE id=$1', [id])).rows[0];
    await migrate(db);
    expect(
      (await db.query('SELECT * FROM profs_characters WHERE id=$1', [id])).rows[0],
    ).toMatchObject({ ...before, slug: '' });
    expect(
      (await db.query("SELECT * FROM profs_scopes WHERE id='retail:us'")).rows[0],
    ).toMatchObject({ game_version: 'retail', guild_realm: 'area-52', guild_slug: '' });
    await db.query(
      "INSERT INTO profs_scopes(id,game_version,region,profile_namespace,data_namespace,guild_name,guild_slug) VALUES('forever:us','forever','us','profile-forever-us','static-forever-us','Rewound','rewound')",
    );
    await db.query(
      "INSERT INTO profs_characters(id,scope_id,api_id,name,slug) VALUES($1,'forever:us',1,'Legacy Smith','legacy-smith')",
      [randomUUID()],
    );
    await expect(
      db.query(
        "INSERT INTO profs_characters(id,scope_id,api_id,name,slug) VALUES($1,'forever:us',2,'Other Smith','legacy-smith')",
        [randomUUID()],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  } finally {
    await db.close();
  }
});
it('upgrades an existing roster without changing its login, characters or compositions', async () => {
  const engine = new PGlite(),
    db = embeddedDatabase(engine);
  try {
    const sql = await readFile(new URL('../migrations/001_workspace.sql', import.meta.url), 'utf8');
    await engine.exec(sql);
    await db.query(
      'CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())',
    );
    await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [
      '001_workspace.sql',
      createHash('sha256').update(sql).digest('hex'),
    ]);
    await bootstrap(db, 'existing', 'migration-test-password', {
      name: 'Existing guild',
      region: 'us',
      ruleset: 'normal',
      faction: 'alliance',
    });
    const guild = (await db.query<{ id: string }>('SELECT id FROM guilds')).rows[0].id;
    const legacyPassword = await hashPassword('legacy-friend-password');
    for (const username of ['bru', 'ct', 'peko']) {
      const userId = randomUUID();
      await db.query('INSERT INTO users(id,username,password_hash) VALUES($1,$2,$3)', [
        userId,
        username,
        legacyPassword,
      ]);
      await db.query("INSERT INTO guild_access(guild_id,user_id,role) VALUES($1,$2,'officer')", [
        guild,
        userId,
      ]);
      await db.query(
        "INSERT INTO invitations(id,guild_id,token_hash,created_by,expires_at) VALUES($1,$2,$3,$4,now()+interval '48 hours')",
        [randomUUID(), guild, randomUUID(), userId],
      );
    }
    const member = randomUUID(),
      character = randomUUID(),
      plan = randomUUID();
    await db.query(
      "INSERT INTO roster_members(id,guild_id,display_name) VALUES($1,$2,'Existing player')",
      [member, guild],
    );
    await db.query(
      "INSERT INTO characters(id,guild_id,member_id,first_name,last_name,region,class,race,faction,ruleset,level,preferred_role,is_main) VALUES($1,$2,$3,'Arden','Oak','us','warrior','human','alliance','normal',60,'tank',true)",
      [character, guild, member],
    );
    await db.query(
      "INSERT INTO plans(id,guild_id,name,encounter,capacity,targets,catalog_version) VALUES($1,$2,'Existing plan','custom',40,'{}','old')",
      [plan, guild],
    );
    await db.query(
      "INSERT INTO assignments(id,guild_id,plan_id,character_id,member_id,role,status,group_number) VALUES($1,$2,$3,$4,$5,'tank','lineup',1)",
      [randomUUID(), guild, plan, character, member],
    );
    const legacySizes = [5, 15, 25, 30, 35];
    for (const capacity of legacySizes)
      await db.query(
        "INSERT INTO plans(id,guild_id,name,encounter,capacity,targets,catalog_version) VALUES($1,$2,$3,'custom',$4,'{}','old')",
        [randomUUID(), guild, 'Old ' + capacity, capacity],
      );
    await migrate(db);
    // A Windows checkout and a Linux deployment must recognize the same applied SQL.
    await db.query('UPDATE schema_migrations SET checksum=$1 WHERE name=$2', [
      createHash('sha256')
        .update(sql.replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'))
        .digest('hex'),
      '001_workspace.sql',
    ]);
    await migrate(db);
    const app = createApp(db, { rateLimit: false }),
      agent = request.agent(app);
    await agent
      .post('/api/login')
      .set('Origin', 'http://localhost:5173')
      .send({ username: 'existing', password: 'migration-test-password' })
      .expect(200);
    const data = (await agent.get('/api/guilds/' + guild + '/snapshot').expect(200)).body;
    expect(data.characters[0]).toMatchObject({
      id: character,
      name: 'Arden Oak',
      spec: 'custom',
      buffs: expect.arrayContaining(['battle_shout', 'pummel', 'sunder_armor']),
    });
    expect(data.plans.find((p: { id: string }) => p.id === plan)).toMatchObject({
      id: plan,
      name: 'Existing plan',
      assignments: [{ characterId: character, group: 1, slot: 1, status: 'lineup' }],
    });
    expect((await db.query('SELECT * FROM roster_members')).rows).toHaveLength(1);
    expect(data).not.toHaveProperty('members');
    expect(data).not.toHaveProperty('officers');
    expect((await db.query('SELECT * FROM invitations')).rows).toEqual([]);
    expect((await db.query("SELECT * FROM guild_access WHERE role='officer'")).rows).toEqual([]);
    expect((await db.query('SELECT * FROM guilds')).rows).toHaveLength(4);
    for (const username of ['bru', 'ct', 'peko']) {
      const friend = request.agent(app);
      await friend
        .post('/api/login')
        .set('Origin', 'http://localhost:5173')
        .send({ username, password: 'legacy-friend-password' })
        .expect(200);
      const session = (await friend.get('/api/session').expect(200)).body;
      expect(session.workspaces).toHaveLength(1);
      expect(session.workspaces[0]).toMatchObject({
        name: username + ' raids',
        role: 'owner',
        region: 'us',
        ruleset: 'normal',
        faction: 'alliance',
      });
      expect(session.workspaces[0].id).not.toBe(guild);
      const personal = (
        await friend.get('/api/guilds/' + session.workspaces[0].id + '/snapshot').expect(200)
      ).body;
      expect(personal.characters).toEqual([]);
      expect(personal.plans).toEqual([]);
      await friend.get('/api/guilds/' + guild + '/snapshot').expect(404);
      expect(
        (
          await db.query<{ password_hash: string }>(
            'SELECT password_hash FROM users WHERE username=$1',
            [username],
          )
        ).rows[0].password_hash,
      ).toBe(legacyPassword);
    }
    for (const [oldSize, newSize] of [
      [5, 10],
      [15, 20],
      [25, 40],
      [30, 40],
      [35, 40],
    ])
      expect(data.plans.find((p: { name: string }) => p.name === 'Old ' + oldSize)).toMatchObject({
        capacity: newSize,
        revision: 3,
      });
    await expect(
      db.query('UPDATE plans SET capacity=15 WHERE id=$1', [plan]),
    ).rejects.toMatchObject({ code: '23514' });
  } finally {
    await db.close();
  }
});
