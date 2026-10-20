import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { embeddedDatabase, migrate, openDatabase, type Database } from './database.js';
import { createApp } from './app.js';
import { bootstrap, createPrivateAccount } from './auth.js';
import { csvHeaders, csvCell, type Snapshot } from '@spf/shared';

const origin = 'http://localhost:5173',
  password = 'test-only-password-123';
let db: Database,
  app: ReturnType<typeof createApp>,
  owner: ReturnType<typeof request.agent>,
  guild: string,
  csrf: string;
beforeAll(async () => {
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    if (!url.pathname.endsWith('_test'))
      throw new Error('Integration tests require a dedicated database whose name ends in _test.');
    process.env.DATABASE_MODE = 'postgres';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    db = await openDatabase();
  } else db = embeddedDatabase(new PGlite());
  await migrate(db);
  app = createApp(db, { rateLimit: false });
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.query('TRUNCATE users,guilds CASCADE');
  await bootstrap(db, 'leader', password, {
    name: 'Test Guild',
    region: 'us',
    faction: 'alliance',
    ruleset: 'normal',
  });
  owner = request.agent(app);
  await owner
    .post('/api/login')
    .set('Origin', origin)
    .send({ username: 'leader', password })
    .expect(200);
  const session = (await owner.get('/api/session')).body;
  guild = session.workspaces[0].id;
  csrf = session.csrfToken;
});
const path = (p: string) => `/api/guilds/${guild}/${p}`;
const post = (p: string, body: object) =>
  owner.post(path(p)).set('Origin', origin).set('X-CSRF-Token', csrf).send(body);
const put = (p: string, body: object) =>
  owner.put(path(p)).set('Origin', origin).set('X-CSRF-Token', csrf).send(body);
const del = (p: string, body: object = {}) =>
  owner.delete(path(p)).set('Origin', origin).set('X-CSRF-Token', csrf).send(body);
const snap = async (): Promise<Snapshot> => (await owner.get(path('snapshot')).expect(200)).body;

function characterInput(name = 'Arden', extras = {}) {
  return {
    name,
    class: 'warrior',
    spec: 'protection',
    role: 'tank',
    buffs: ['battle_shout'],
    ...extras,
  };
}
async function character(name = 'Arden', extras = {}) {
  return (await post('characters', characterInput(name, extras)).expect(201)).body.id as string;
}
async function plan(capacity = 20) {
  return (await post('plans', { name: 'Progression', capacity, notes: '' }).expect(201)).body
    .id as string;
}
const assignment = (characterId: string, extras = {}) => ({
  characterId,
  status: 'lineup',
  group: 1,
  ...extras,
});
async function revision(id: string) {
  return (await snap()).plans.find((p) => p.id === id)!.revision;
}
async function assign(id: string, c: string, extras = {}) {
  await put('plans/' + id + '/assignments', {
    revision: await revision(id),
    assignment: assignment(c, extras),
  }).expect(200);
}
async function privateAccount(username = 'bru') {
  const account = await createPrivateAccount(db, username, password, {
    name: username + ' raids',
    region: 'us',
    faction: 'alliance',
    ruleset: 'normal',
  });
  const agent = request.agent(app);
  await agent
    .post('/api/login')
    .set('Origin', origin)
    .send({ username: username.toUpperCase(), password })
    .expect(200);
  const session = (await agent.get('/api/session')).body;
  return {
    agent,
    csrf: session.csrfToken as string,
    id: account.userId,
    guildId: account.guildId,
    session,
  };
}
describe('private accounts', () => {
  it('uses HttpOnly sessions, rejects public registration and does not expose password hashes', async () => {
    const login = await request(app)
      .post('/api/login')
      .set('Origin', origin)
      .send({ username: 'leader', password })
      .expect(200);
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(login.headers['set-cookie'][0]).toContain('SameSite=Strict');
    expect(JSON.stringify((await owner.get('/api/session')).body)).not.toContain('password');
    await request(app).get(path('snapshot')).expect(401);
    await request(app)
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ username: 'stranger', password })
      .expect(404);
    await request(app)
      .put('/api/user/anything')
      .set('Origin', origin)
      .send({ username: 'takeover' })
      .expect(404);
    await expect(
      bootstrap(db, 'second-owner', password, {
        name: 'Other',
        region: 'us',
        faction: 'alliance',
        ruleset: 'normal',
      }),
    ).rejects.toThrow('already exists');
  });
  it('requires the application origin and a session CSRF token for changes', async () => {
    await owner
      .post(path('characters'))
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', csrf)
      .send(characterInput('Intruder'))
      .expect(403);
    await owner
      .post(path('characters'))
      .set('Origin', origin)
      .send(characterInput('Intruder'))
      .expect(403);
    await post('characters', { ...characterInput('Good'), userId: randomUUID() }).expect(400);
    expect((await snap()).characters).toHaveLength(0);
  });
  it('expires and revokes sessions on the server', async () => {
    await db.query("UPDATE sessions SET expires_at=now()-interval '1 second'");
    await owner.get(path('snapshot')).expect(401);
    await owner
      .post('/api/login')
      .set('Origin', origin)
      .send({ username: 'leader', password })
      .expect(200);
    csrf = (await owner.get('/api/session')).body.csrfToken;
    await owner.post('/api/logout').set('Origin', origin).set('X-CSRF-Token', csrf).expect(200);
    await owner.get(path('snapshot')).expect(401);
  });
  it('gives each login a private planner and rejects access to another account', async () => {
    const c = await character(),
      p = await plan();
    await assign(p, c);
    for (const username of ['bru', 'ct', 'peko']) {
      const user = await privateAccount(username);
      expect(user.session.workspaces).toHaveLength(1);
      expect(user.session.workspaces[0].id).toBe(user.guildId);
      expect(
        (await user.agent.get('/api/guilds/' + user.guildId + '/snapshot').expect(200)).body
          .characters,
      ).toEqual([]);
      await user.agent.get(path('snapshot')).expect(404);
      await user.agent.get(path('backup')).expect(404);
      await user.agent.get(path('export.csv')).expect(404);
      await user.agent
        .put(path('characters/' + c))
        .set('Origin', origin)
        .set('X-CSRF-Token', user.csrf)
        .send({ character: characterInput('Stolen'), revision: 1 })
        .expect(404);
      await user.agent
        .delete(path('plans/' + p))
        .set('Origin', origin)
        .set('X-CSRF-Token', user.csrf)
        .send({ revision: await revision(p) })
        .expect(404);
      await owner.get('/api/guilds/' + user.guildId + '/snapshot').expect(404);
      await user.agent
        .post('/api/guilds/' + user.guildId + '/characters')
        .set('Origin', origin)
        .set('X-CSRF-Token', user.csrf)
        .send(characterInput())
        .expect(201);
      await expect(
        createPrivateAccount(db, username.toUpperCase(), 'a-different-password', {
          name: 'Replacement',
          region: 'us',
          faction: 'alliance',
          ruleset: 'normal',
        }),
      ).rejects.toThrow('already exists');
      await user.agent
        .post('/api/login')
        .set('Origin', origin)
        .send({ username, password })
        .expect(200);
    }
    expect((await snap()).characters.map((character) => character.name)).toEqual(['Arden']);
    expect((await owner.get('/api/session')).body.workspaces).toHaveLength(1);
  });
  it('retires shared-edit invitations and ignores legacy officer access', async () => {
    const user = await privateAccount();
    await db.query("INSERT INTO guild_access(guild_id,user_id,role) VALUES($1,$2,'officer')", [
      guild,
      user.id,
    ]);
    expect(
      (await user.agent.get('/api/session')).body.workspaces.map((w: { id: string }) => w.id),
    ).toEqual([user.guildId]);
    await user.agent.get(path('snapshot')).expect(404);
    await post('invitations', {}).expect(404);
    await owner.get(path('invitations')).expect(404);
    await del('officers/' + user.id).expect(404);
    await request(app)
      .post('/api/invitations/accept')
      .set('Origin', origin)
      .send({ token: 'x'.repeat(43), username: 'new', password })
      .expect(404);
  });

  it('scopes character assignments and database relationships to the workspace', async () => {
    const other = randomUUID(),
      foreign = randomUUID();
    await db.query(
      "INSERT INTO guilds(id,name,region,ruleset,faction) VALUES($1,'Other','us','normal','alliance')",
      [other],
    );
    await db.query(
      "INSERT INTO characters(id,guild_id,first_name,last_name,region,class,race,faction,ruleset,level,preferred_role) VALUES($1,$2,'Secret','','us','warrior','human','alliance','normal',60,'tank')",
      [foreign, other],
    );
    await owner.get('/api/guilds/' + other + '/snapshot').expect(404);
    await del('characters/' + foreign, { revision: 1 }).expect(404);
    expect((await db.query('SELECT id FROM characters WHERE id=$1', [foreign])).rows).toHaveLength(
      1,
    );
    const p = await plan();
    await put('plans/' + p + '/assignments', {
      revision: 1,
      assignment: assignment(foreign),
    }).expect(404);
    await expect(
      db.query(
        "INSERT INTO assignments(id,guild_id,plan_id,character_id,role,status) VALUES($1,$2,$3,$4,'tank','lineup')",
        [randomUUID(), guild, p, foreign],
      ),
    ).rejects.toMatchObject({ code: '23503' });
    expect((await snap()).characters).toHaveLength(0);
  });
});
describe('character compositions', () => {
  it('only accepts 10, 20 and 40-man compositions on creation and editing', async () => {
    for (const capacity of [10, 20, 40]) await plan(capacity);
    const p = (await snap()).plans[0];
    for (const capacity of [5, 15, 25, 30, 35]) {
      await post('plans', { name: 'Invalid', capacity }).expect(400);
      await put('plans/' + p.id, {
        revision: p.revision,
        plan: { name: 'Invalid', capacity },
      }).expect(400);
    }
    expect((await snap()).plans).toHaveLength(3);
  });

  it('creates characters without player records and keeps the API minimal', async () => {
    await character();
    const data = await snap();
    expect(data.characters[0]).toMatchObject({
      name: 'Arden',
      class: 'warrior',
      spec: 'protection',
      role: 'tank',
      buffs: ['battle_shout'],
    });
    expect(data).not.toHaveProperty('members');
    expect(data.characters[0]).not.toHaveProperty('memberId');
    expect((await db.query('SELECT * FROM roster_members')).rows).toHaveLength(0);
    await post('members', { displayName: 'Old workflow' }).expect(404);
  });
  it('validates class buffs, specs and incompatible loadouts on the server', async () => {
    await post('characters', characterInput('Wrong', { buffs: ['moonkin_aura'] })).expect(400);
    await post('characters', characterInput('Wrong', { spec: 'balance' })).expect(400);
    await post(
      'characters',
      characterInput('Wrong', {
        class: 'shaman',
        spec: 'enhancement',
        role: 'melee',
        buffs: ['windfury_totem', 'grace_of_air'],
      }),
    ).expect(400);
    expect((await snap()).characters).toHaveLength(0);
  });
  it('rejects stale edits and refreshes all compositions sharing a character', async () => {
    const c = await character(),
      p = await plan(),
      p2 = await plan();
    await assign(p, c);
    await assign(p2, c);
    const input = { character: characterInput('Renamed'), revision: 1 };
    await put('characters/' + c, input).expect(200);
    await put('characters/' + c, input).expect(409);
    expect((await snap()).plans.every((p) => p.revision === 3)).toBe(true);
    await put('plans/' + p + '/assignments', {
      revision: 2,
      assignment: assignment(c, { status: 'bench' }),
    }).expect(409);
    expect((await snap()).plans.find((plan) => plan.id === p)!.assignments[0].status).toBe(
      'lineup',
    );
  });
  it('deletes a character and its assignments across raids, rejecting stale deletions', async () => {
    const c = await character('Unwanted template'),
      keep = await character('Keep'),
      p = await plan(10),
      p2 = await plan(20),
      untouched = await plan(40);
    await assign(p, c);
    await assign(p2, c, { status: 'bench', group: null });
    await assign(p, keep);
    await put('characters/' + c, {
      character: characterInput('Renamed template'),
      revision: 1,
    }).expect(200);
    const before = await snap();
    await del('characters/' + c, { revision: 1 }).expect(409);
    expect(await snap()).toEqual(before);
    await del('characters/' + c, { revision: 2 }).expect(200);
    const after = await snap();
    expect(after.characters.map((character) => character.id)).toEqual([keep]);
    for (const plan of after.plans) {
      expect(plan.assignments.some((a) => a.characterId === c)).toBe(false);
      expect(plan.revision).toBe(
        before.plans.find((p) => p.id === plan.id)!.revision + (plan.id === untouched ? 0 : 1),
      );
    }
    expect(after.plans.find((plan) => plan.id === p)!.assignments[0].characterId).toBe(keep);
    await del('characters/' + c, { revision: 2 }).expect(404);
    await character('Renamed template');
  });
  it('adds and assigns atomically, rolling back the character if a group is full', async () => {
    const p = await plan(10);
    for (let i = 0; i < 5; i++)
      await post('plans/' + p + '/characters', {
        character: characterInput('Tank ' + i),
        revision: await revision(p),
        group: 1,
        status: 'lineup',
      }).expect(201);
    await post('plans/' + p + '/characters', {
      character: characterInput('Overflow'),
      revision: await revision(p),
      group: 1,
      status: 'lineup',
    }).expect(400);
    expect((await snap()).characters).toHaveLength(5);
    expect(await revision(p)).toBe(6);
    await post('plans/' + p + '/characters', {
      character: characterInput('Stale'),
      revision: 1,
      group: 2,
      status: 'lineup',
    }).expect(409);
    expect((await snap()).characters).toHaveLength(5);
  });
  it('enforces raid capacity, five-person groups, and excludes the bench from limits', async () => {
    const p = await plan(10);
    let first = '';
    for (let i = 0; i < 10; i++) {
      const c = await character('Character ' + i);
      if (!i) first = c;
      await assign(p, c, { group: i < 5 ? 1 : 2 });
    }
    const extra = await character('Reserve');
    await put('plans/' + p + '/assignments', {
      revision: await revision(p),
      assignment: assignment(extra, { group: 2 }),
    }).expect(400);
    await assign(p, extra, { status: 'bench', group: 2 });
    expect(
      (await snap()).plans[0].assignments.find((a) => a.characterId === extra)?.group,
    ).toBeNull();
    await assign(p, first, { status: 'bench' });
    await put('plans/' + p + '/assignments', {
      revision: await revision(p),
      assignment: assignment(extra, { group: 2 }),
    }).expect(400);
    await assign(p, extra, { group: 1 });
    await put('plans/' + p, {
      revision: await revision(p),
      plan: { name: 'Invalid size', capacity: 15, notes: '' },
    }).expect(400);
  });
  it('duplicates group assignments while retaining independent compositions', async () => {
    const c = await character(),
      p = await plan();
    await assign(p, c, { group: 2 });
    const copy = (
      await post('plans/' + p + '/duplicate', { revision: await revision(p) }).expect(201)
    ).body.id;
    await assign(copy, c, { status: 'bench' });
    expect((await snap()).plans.find((plan) => plan.id === p)!.assignments[0]).toMatchObject({
      status: 'lineup',
      group: 2,
    });
    expect((await snap()).plans.find((plan) => plan.id === copy)!.assignments[0]).toMatchObject({
      status: 'bench',
      group: null,
    });
    await del('plans/' + copy, { revision: 1 }).expect(409);
    await del('plans/' + copy, { revision: await revision(copy) }).expect(200);
    expect((await snap()).characters).toHaveLength(1);
  });
  it('imports character buff loadouts atomically and exports without account secrets', async () => {
    const row = (name: string, cls = 'warrior') =>
      [name, cls, 'custom', 'tank', JSON.stringify(['battle_shout'])].map(csvCell).join(',');
    await post('import', {
      csv: [csvHeaders.join(','), row('Valid'), row('Invalid', 'mage')].join('\r\n'),
    }).expect(400);
    expect((await snap()).characters).toHaveLength(0);
    await post('import', { csv: [csvHeaders.join(','), row('Imported')].join('\r\n') }).expect(201);
    const csv = await owner.get(path('export.csv')).expect(200);
    expect(csv.text).toContain('battle_shout');
    expect(csv.text).toContain('name,class,spec,role,buffs');
    const backup = (await owner.get(path('backup')).expect(200)).body;
    expect(backup.version).toBe(2);
    expect(backup.characters).toHaveLength(1);
    for (const secret of ['password', 'csrfToken', 'officers', 'invitations', 'members'])
      expect(backup).not.toHaveProperty(secret);
  });
});

describe('fixed raid positions and atomic swaps', () => {
  async function fullRaid() {
    const p = await plan(10);
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const c = await character('Slot ' + i);
      ids.push(c);
      await assign(p, c, { group: i < 5 ? 1 : 2, slot: (i % 5) + 1 });
    }
    return { p, ids };
  }
  it('swaps between two full groups and reorders within a group without losing characters', async () => {
    const { p, ids } = await fullRaid();
    await assign(p, ids[0], { group: 2, slot: 3 });
    let raid = (await snap()).plans[0];
    expect(raid.assignments.find((a) => a.characterId === ids[0])).toMatchObject({
      group: 2,
      slot: 3,
    });
    expect(raid.assignments.find((a) => a.characterId === ids[7])).toMatchObject({
      group: 1,
      slot: 1,
    });
    await assign(p, ids[7], { group: 1, slot: 2 });
    raid = (await snap()).plans[0];
    expect(raid.assignments.find((a) => a.characterId === ids[1])).toMatchObject({
      group: 1,
      slot: 1,
    });
    expect(raid.assignments).toHaveLength(10);
    expect(new Set(raid.assignments.map((a) => a.group + ':' + a.slot)).size).toBe(10);
  });
  it('swaps a benched character into a full raid slot', async () => {
    const { p, ids } = await fullRaid(),
      reserve = await character('Reserve');
    await assign(p, reserve, { status: 'bench' });
    await assign(p, reserve, { group: 1, slot: 1 });
    const raid = (await snap()).plans[0];
    expect(raid.assignments.find((a) => a.characterId === reserve)).toMatchObject({
      group: 1,
      slot: 1,
      status: 'lineup',
    });
    expect(raid.assignments.find((a) => a.characterId === ids[0])).toMatchObject({
      group: null,
      slot: null,
      status: 'bench',
    });
    expect(raid.assignments.filter((a) => a.status === 'lineup')).toHaveLength(10);
  });
  it('returns a displaced character to the pool while preserving other compositions', async () => {
    const { p, ids } = await fullRaid(),
      other = await plan(),
      reserve = await character('New tank');
    await assign(other, ids[0], { group: 1 });
    await assign(p, reserve, { group: 1, slot: 1 });
    const data = await snap();
    expect(
      data.plans.find((plan) => plan.id === p)!.assignments.some((a) => a.characterId === ids[0]),
    ).toBe(false);
    expect(
      data.plans
        .find((plan) => plan.id === other)!
        .assignments.some((a) => a.characterId === ids[0]),
    ).toBe(true);
    expect(data.characters.some((c) => c.id === ids[0])).toBe(true);
  });
  it('creates templates in occupied slots atomically and rejects stale or invalid positions', async () => {
    const { p, ids } = await fullRaid();
    let rev = await revision(p);
    const added = await post('plans/' + p + '/characters', {
      character: characterInput('Template'),
      revision: rev,
      group: 1,
      slot: 1,
      status: 'lineup',
    }).expect(201);
    let data = await snap(),
      raid = data.plans.find((plan) => plan.id === p)!;
    expect(raid.assignments).toHaveLength(10);
    expect(raid.assignments.some((a) => a.characterId === ids[0])).toBe(false);
    expect(raid.assignments.find((a) => a.characterId === added.body.id)).toMatchObject({
      group: 1,
      slot: 1,
    });
    await post('plans/' + p + '/characters', {
      character: characterInput('Stale template'),
      revision: rev,
      group: 1,
      slot: 2,
      status: 'lineup',
    }).expect(409);
    await put('plans/' + p + '/assignments', {
      assignment: assignment(ids[1], { group: 1, slot: 6 }),
      revision: raid.revision,
    }).expect(400);
    data = await snap();
    expect(data.characters).toHaveLength(11);
  });
  it('preserves exact slots when duplicating compositions', async () => {
    const p = await plan(),
      c = await character();
    await assign(p, c, { group: 2, slot: 5 });
    const result = await post('plans/' + p + '/duplicate', { revision: await revision(p) }).expect(
      201,
    );
    expect(
      (await snap()).plans.find((plan) => plan.id === result.body.id)!.assignments[0],
    ).toMatchObject({ group: 2, slot: 5 });
  });
});
