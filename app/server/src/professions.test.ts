import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { embeddedDatabase, migrate } from './database.js';
import { createPrivateAccount } from './auth.js';
import { createApp } from './app.js';
import { ProfessionService } from './professions.js';
import { blizzardSettings, BlizzardError, type BlizzardSource } from './blizzard.js';

// Contract-only synthetic characters and recipes. No fixture is imported by the real application.
const db = embeddedDatabase(new PGlite());
const origin = 'http://localhost:5173';
const password = 'professions-test-password';
const characters = [
  { id: 1, name: 'Fixtureone', slug: 'fixtureone-smith', classId: 8 },
  { id: 2, name: 'Fixturetwo', slug: 'fixturetwo-smith', classId: 13 },
  { id: 3, name: 'Unfetchedfixture', slug: 'unfetchedfixture-smith' },
];
const snapshot = {
  tiers: [
    {
      professionId: 1,
      profession: 'Test Alchemy',
      tierId: 10,
      expansion: 'Test Expansion',
      skill: 5,
      maxSkill: 100,
      recipesAvailable: true,
      recipes: [{ id: 90, name: 'Shared test recipe' }],
    },
    {
      professionId: 2,
      profession: 'Test Gathering',
      tierId: 20,
      expansion: 'Other tier',
      skill: 1,
      maxSkill: 100,
      recipesAvailable: false,
      recipes: [],
    },
  ],
};
const source: BlizzardSource = {
  configured: true,
  roster: vi.fn(async () => ({ guildId: 8, characters })),
  character: vi.fn(async (slug) => ({
    ...characters.find((c) => c.slug === slug)!,
    slug,
    snapshot,
  })),
  recipe: vi.fn(async (id) => ({
    id,
    name: 'Shared test recipe',
    reagents: [{ id: 765, name: 'Test ingredient', quantity: 2 }],
    items: [
      { id: 700, name: 'Different crafted test item' },
      { id: 701, name: 'Second crafted test item' },
    ],
  })),
};
const settings = {
  ...blizzardSettings(),
  admins: ['directoryadmin'],
  clientId: 'test',
  clientSecret: 'test',
};
let service: ProfessionService;
let app: ReturnType<typeof createApp>;
let member: ReturnType<typeof request.agent>;
let admin: ReturnType<typeof request.agent>;
let memberCsrf: string, adminCsrf: string, memberId: string, ids: string[];
beforeAll(async () => {
  await migrate(db);
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.query('TRUNCATE profs_scopes,users,guilds CASCADE');
  vi.clearAllMocks();
  service = new ProfessionService(db, settings, source);
  app = createApp(db, { rateLimit: false, professions: service });
  for (const username of ['directoryadmin', 'ordinary']) {
    const account = await createPrivateAccount(db, username, password, {
      name: 'Private planner',
      region: 'us',
      ruleset: 'normal',
      faction: 'alliance',
    });
    if (username === 'ordinary') memberId = account.userId;
  }
  admin = request.agent(app);
  member = request.agent(app);
  for (const [agent, username] of [
    [admin, 'directoryadmin'],
    [member, 'ordinary'],
  ] as const)
    await agent.post('/api/login').set('Origin', origin).send({ username, password }).expect(200);
  adminCsrf = (await admin.get('/api/session')).body.csrfToken;
  memberCsrf = (await member.get('/api/session')).body.csrfToken;
  await service.queue('roster');
  await service.workOne();
  ids = (
    await db.query<{ id: string }>('SELECT id FROM profs_characters ORDER BY api_id')
  ).rows.map((c) => c.id);
});
function post(agent: typeof member, path: string, body: object = {}, csrf = memberCsrf) {
  return agent
    .post('/api/profs/' + path)
    .set('Origin', origin)
    .set('X-CSRF-Token', csrf)
    .send(body);
}
function put(agent: typeof member, path: string, body: object, csrf = memberCsrf) {
  return agent
    .put('/api/profs/' + path)
    .set('Origin', origin)
    .set('X-CSRF-Token', csrf)
    .send(body);
}
describe('shared professions directory', () => {
  it('cancels an in-flight fetch on shutdown and leaves the job ready for restart without clearing cached data', async () => {
    let cancel: (() => void) | undefined;
    vi.mocked(source.character).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          cancel = () => reject(new BlizzardError(503, 'Cancelled for shutdown'));
        }),
    );
    source.stop = () => cancel?.();
    const stop = service.start();
    try {
      await vi.waitFor(() => expect(cancel).toBeDefined());
      await stop();
      const jobs = (await db.query('SELECT started_at,lease_until FROM profs_jobs')).rows;
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs.every((j) => j.started_at === null && j.lease_until === null)).toBe(true);
      expect(
        (await db.query('SELECT error FROM profs_characters WHERE error IS NOT NULL')).rows,
      ).toHaveLength(0);
      expect(
        (await db.query('SELECT api_backoff_until FROM profs_scopes')).rows[0].api_backoff_until,
      ).toBeNull();
    } finally {
      source.stop = undefined;
    }
  });
  it('automatically seeds unfetched characters, deduplicates across workers and refreshes hourly', async () => {
    const other = new ProfessionService(db, settings, source);
    await Promise.all([service.scheduleDue(), other.scheduleDue()]);
    expect((await db.query('SELECT id FROM profs_jobs')).rows).toHaveLength(3);
    await service.workOne();
    expect(await service.scheduleDue()).toBe(0);
    const fetched = (
      await db.query<{ id: string }>(
        'SELECT id FROM profs_characters WHERE last_success IS NOT NULL',
      )
    ).rows[0];
    await db.query(
      "UPDATE profs_characters SET last_attempt=now()-interval '61 minutes',refresh_after=now()-interval '1 minute' WHERE id=$1",
      [fetched.id],
    );
    expect(await service.scheduleDue()).toBe(1);
    expect(
      (await db.query('SELECT id FROM profs_jobs WHERE character_id=$1', [fetched.id])).rows,
    ).toHaveLength(1);
    const disabled = new ProfessionService(db, { ...settings, autoRefresh: false }, source);
    expect(await disabled.scheduleDue()).toBe(0);
  });
  it('bounds automatic jobs, reserves manual capacity and processes manual refreshes first', async () => {
    for (let n = 4; n <= 113; n++)
      await db.query(
        `INSERT INTO profs_characters(id,scope_id,api_id,name,slug,in_roster) VALUES($1,$2,$3,$4,$4,true)`,
        [randomUUID(), service.scope, n, 'AutoFixture' + n],
      );
    for (let n = 0; n < 5; n++) await service.scheduleDue();
    expect((await db.query('SELECT id FROM profs_jobs')).rows).toHaveLength(90);
    const manual = (
      await db.query<{ id: string; api_id: string; name: string; slug: string }>(
        'SELECT * FROM profs_characters c WHERE NOT EXISTS(SELECT 1 FROM profs_jobs j WHERE j.character_id=c.id) LIMIT 1',
      )
    ).rows[0];
    await service.queue('character', manual.id);
    vi.mocked(source.character).mockResolvedValueOnce({
      id: Number(manual.api_id),
      name: manual.name,
      slug: manual.slug,
      snapshot,
    });
    await service.workOne();
    expect(source.character).toHaveBeenLastCalledWith(manual.slug);
    expect(
      (await db.query('SELECT last_success FROM profs_characters WHERE id=$1', [manual.id]))
        .rows[0],
    ).not.toHaveProperty('last_success', null);
  });
  it('refreshes the roster on schedule, enriches recipes during seeding, and pauses after rate limiting', async () => {
    await db.query('UPDATE profs_scopes SET roster_synced=NULL,roster_refresh_after=NULL');
    await service.workOne(true, true);
    expect(source.roster).toHaveBeenCalledTimes(2);
    await service.workOne(true, true);
    expect(source.recipe).toHaveBeenCalled();
    vi.mocked(source.character).mockRejectedValueOnce(
      new BlizzardError(429, 'Blizzard rate limit reached. Retry after the cooldown.'),
    );
    await service.workOne(true, true);
    expect(await service.scheduleDue()).toBe(0);
    expect(await service.workOne()).toBe(false);
    expect((await member.get('/api/profs')).body.automaticRefresh.backoffUntil).toBeTruthy();
  });
  it('prioritizes visible recipe details without exposing a new ownership or credential path', async () => {
    await service.queue('character', ids[0]);
    await service.workOne();
    await request(app)
      .post('/api/profs/recipe-details')
      .set('Origin', origin)
      .send({ recipeIds: [90] })
      .expect(401);
    await member
      .post('/api/profs/recipe-details')
      .set('Origin', origin)
      .send({ recipeIds: [90] })
      .expect(403);
    await post(member, 'recipe-details', { recipeIds: [90] }).expect(202);
    expect(
      (await db.query('SELECT detail_priority FROM profs_recipes WHERE api_id=90')).rows[0]
        .detail_priority,
    ).toBeTruthy();
    const csp = (await request(app).get('/api/health')).headers['content-security-policy'];
    expect(csp).toContain('https://wow.zamimg.com');
    expect(csp).not.toContain("'unsafe-eval'");
  });
  it('imports realmless members with unknown coverage and protects routes, CSRF and administrator actions', async () => {
    await request(app).get('/api/profs').expect(200);
    await request(createApp(db, { professions: service }))
      .head('/api/profs')
      .expect(200);
    await member.post('/api/profs/refresh-roster').set('Origin', origin).expect(403);
    await post(member, 'refresh-roster').expect(403);
    const data = (await member.get('/api/profs').expect(200)).body;
    expect(data.admin).toBe(false); // Owning a private planner is not guild administration.
    expect(data.characters[1]).toMatchObject({
      slug: 'fixturetwo-smith',
      lastSuccess: null,
      snapshot: null,
      member: null,
    });
    expect(data.recipes).toEqual([]);
    expect(data.characters.map((c: { classId: number | null }) => c.classId)).toEqual([
      8,
      13,
      null,
    ]);
    expect(JSON.stringify(data)).not.toMatch(/clientSecret|password_hash|csrf_token/);
  });
  it('preserves known classes when a later roster or profile omits class metadata', async () => {
    vi.mocked(source.character).mockResolvedValueOnce({
      id: 1,
      name: characters[0].name,
      slug: characters[0].slug,
      snapshot,
    });
    await service.queue('character', ids[0]);
    await service.workOne();
    await db.query('UPDATE profs_scopes SET roster_refresh_after=NULL');
    vi.mocked(source.roster).mockResolvedValueOnce({
      guildId: 8,
      characters: characters.map(({ id, name, slug }) => ({ id, name, slug })),
    });
    await service.queue('roster');
    await service.workOne();
    expect((await request(app).get('/api/profs')).body.characters[0].classId).toBe(8);
  });
  it('allows public recipe discovery while keeping account contacts and all writes private', async () => {
    await service.queue('character', ids[0]);
    await service.workOne();
    await post(member, 'claims', { characterId: ids[0] }).expect(201);
    const claim = (await admin.get('/api/profs')).body.claims[0];
    await put(admin, 'claims/' + claim.id, { status: 'approved' }, adminCsrf).expect(200);
    await put(member, 'member', {
      discord: 'private-fixture-contact',
      mainCharacterId: ids[0],
    }).expect(200);
    const data = (
      await request(app)
        .get('/api/profs?admin=true&userId=' + memberId)
        .expect(200)
    ).body;
    expect(data.admin).toBe(false);
    expect(data.claims).toEqual([]);
    expect(data.myProfile).toEqual({ discord: '', mainCharacterId: null });
    expect(data.recipes[0].characterIds).toContain(ids[0]);
    expect(
      data.characters.every((c: Record<string, unknown>) =>
        ['member', 'memberId', 'discord', 'main', 'isMain'].every((key) => c[key] === null),
      ),
    ).toBe(true);
    expect(JSON.stringify(data)).not.toContain('private-fixture-contact');
    expect(
      (
        await request(app)
          .get('/api/profs/characters/' + ids[0])
          .expect(200)
      ).body.snapshot,
    ).toBeTruthy();
    expect(
      (await request(app).get('/api/profs/recipes/90/providers').expect(200)).body.characterIds,
    ).toEqual([ids[0]]);
    for (const path of ['characters/' + ids[0] + '/refresh', 'claims', 'refresh-roster'])
      await request(app)
        .post('/api/profs/' + path)
        .set('Origin', origin)
        .send({ characterId: ids[0] })
        .expect(401);
    await request(app)
      .put('/api/profs/member')
      .set('Origin', origin)
      .send({ discord: 'changed' })
      .expect(401);
    await request(app).get('/api/profs/recipes/90/coverage').expect(401);
    const guild = (await member.get('/api/session')).body.workspaces[0].id;
    await request(app)
      .get('/api/guilds/' + guild + '/snapshot')
      .expect(401);
    expect(
      (await member.get('/api/profs')).body.characters.find((c: { id: string }) => c.id === ids[0])
        .discord,
    ).toBe('private-fixture-contact');
  });
  it('serves cached materials publicly and bounds hover warming to registered recipes', async () => {
    await service.queue('character', ids[0]);
    await service.workOne();
    const before = await request(app).get('/api/profs/recipes/90/materials').expect(200);
    expect(before.body).toMatchObject({ ready: false, reagents: null });
    expect(service.requestedRecipes.has(90)).toBe(true);
    await service.enrichRecipes();
    const cached = await request(app).get('/api/profs/recipes/90/materials').expect(200);
    expect(cached.body).toMatchObject({
      ready: true,
      gameVersion: 'forever',
      reagents: [{ id: 765, name: 'Test ingredient', quantity: 2 }],
    });
    expect(service.requestedRecipes.has(90)).toBe(false);
    await request(app).get('/api/profs/recipes/999999/materials').expect(404);
    expect(service.requestedRecipes.has(999999)).toBe(false);
    vi.mocked(source.recipe).mockRejectedValueOnce(new Error('Unavailable'));
    await db.query(
      "UPDATE profs_recipes SET details_fetched=now()-interval '31 days',detail_attempt=NULL WHERE api_id=90",
    );
    await service.enrichRecipes();
    expect(
      (await request(app).get('/api/profs/recipes/90/materials').expect(200)).body.reagents,
    ).toEqual(cached.body.reagents);
  });
  it('matches one recipe to two fetched characters and searches distinct crafted-item mappings', async () => {
    for (const id of ids.slice(0, 2)) {
      await service.queue('character', id);
      await service.workOne();
    }
    let data = (await member.get('/api/profs?q=Shared')).body;
    expect(data.recipes).toHaveLength(1);
    expect(new Set(data.recipes[0].characterIds)).toEqual(new Set(ids.slice(0, 2)));
    expect(
      new Set((await member.get('/api/profs/recipes/90/providers').expect(200)).body.characterIds),
    ).toEqual(new Set(ids.slice(0, 2)));
    expect(data.characters[2].lastSuccess).toBeNull();
    expect(data.itemDetailsPending).toBe(1);
    await service.workOne();
    data = (
      await member.get(
        '/api/profs?q=Different%20crafted&profession=Test%20Alchemy&expansion=Test%20Expansion',
      )
    ).body;
    expect(data.recipes[0]).toMatchObject({
      id: 90,
      detailsFetched: true,
      items: [
        { id: 700, name: 'Different crafted test item' },
        { id: 701, name: 'Second crafted test item' },
      ],
    });
    expect((await member.get('/api/profs?q=701')).body.recipes).toHaveLength(1);
    expect(
      (await member.get('/api/profs?character=' + ids[1])).body.recipes[0].characterIds,
    ).toEqual([ids[1]]);
    expect(data.professions).toContain('Test Gathering');
    const coverageUrl =
      '/api/profs/recipes/90/coverage?profession=Test%20Alchemy&expansion=Test%20Expansion';
    const coverage = (await member.get(coverageUrl).expect(200)).body;
    expect(coverage.characters.filter((c: { state: string }) => c.state === 'known')).toHaveLength(
      2,
    );
    expect(coverage.characters.find((c: { id: string }) => c.id === ids[2]).state).toBe('unknown');
    const empty = structuredClone(snapshot);
    empty.tiers[0].recipes = [];
    vi.mocked(source.character).mockResolvedValueOnce({ ...characters[2], snapshot: empty });
    await service.queue('character', ids[2]);
    await service.workOne();
    expect(
      (await member.get(coverageUrl)).body.characters.find((c: { id: string }) => c.id === ids[2])
        .state,
    ).toBe('not_listed');
    await db.query('UPDATE profs_characters SET refresh_after=NULL WHERE id=$1', [ids[2]]);
    empty.tiers[0].recipesAvailable = false;
    vi.mocked(source.character).mockResolvedValueOnce({ ...characters[2], snapshot: empty });
    await service.queue('character', ids[2]);
    await service.workOne();
    expect(
      (await member.get(coverageUrl)).body.characters.find((c: { id: string }) => c.id === ids[2])
        .state,
    ).toBe('unknown');
  });
  it('deduplicates refreshes, survives failures and never clears last successful recipe ownership', async () => {
    await post(member, `characters/${ids[0]}/refresh`).expect(202);
    await post(member, `characters/${ids[0]}/refresh`).expect(429);
    await service.workOne();
    const before = (await member.get('/api/profs')).body;
    await db.query('UPDATE profs_characters SET refresh_after=NULL WHERE id=$1', [ids[0]]);
    vi.mocked(source.character).mockRejectedValueOnce(
      new BlizzardError(404, 'Blizzard data is unavailable (404). Last successful data was kept.'),
    );
    await service.queue('character', ids[0]);
    await service.workOne();
    const after = (await member.get('/api/profs')).body;
    expect(after.characters[0].lastSuccess).toBe(before.characters[0].lastSuccess);
    expect(after.characters[0].error).toContain('404');
    expect(after.recipes[0].characterIds).toEqual([ids[0]]);
    expect(
      (await member.get('/api/profs/characters/' + ids[0])).body.snapshot.tiers[0].recipes,
    ).toEqual(snapshot.tiers[0].recipes);
    vi.mocked(source.roster).mockRejectedValueOnce(
      new BlizzardError(503, 'Blizzard is temporarily unreachable.'),
    );
    await db.query('UPDATE profs_scopes SET roster_refresh_after=NULL');
    await service.queue('roster');
    await service.workOne();
    expect((await member.get('/api/profs')).body.characters).toHaveLength(3);
  });
  it('requires explicit approval, reuses account identity, and revokes displayed contact on rejection', async () => {
    await post(member, 'claims', { characterId: ids[0] }).expect(201);
    await put(member, 'member', { discord: 'fixture-contact', mainCharacterId: ids[0] }).expect(
      403,
    );
    const claim = (await admin.get('/api/profs')).body.claims[0];
    await put(member, 'claims/' + claim.id, { status: 'approved' }).expect(403);
    await put(admin, 'claims/' + claim.id, { status: 'approved' }, adminCsrf).expect(200);
    await put(member, 'member', { discord: 'fixture-contact', mainCharacterId: ids[0] }).expect(
      200,
    );
    expect((await member.get('/api/profs')).body.characters[0]).toMatchObject({
      member: 'ordinary',
      memberId,
      main: 'Fixtureone',
      isMain: true,
      discord: 'fixture-contact',
    });
    await put(admin, 'claims/' + claim.id, { status: 'rejected' }, adminCsrf).expect(200);
    expect((await member.get('/api/profs')).body.characters[0]).toMatchObject({
      member: null,
      discord: null,
      main: null,
    });
  });
  it('isolates game scopes and refuses namespace changes within an existing scope', async () => {
    const legacy = new ProfessionService(
      db,
      {
        ...settings,
        gameVersion: 'retail',
        profileNamespace: 'profile-us',
        dataNamespace: 'static-us',
      },
      source,
    );
    expect((await legacy.directory(memberId, false, {})).characters).toEqual([]);
    const legacyId = randomUUID();
    await db.query(
      "INSERT INTO profs_characters(id,scope_id,api_id,name,realm,in_roster) VALUES($1,$2,1,'Retail fixture','area-52',true)",
      [legacyId, legacy.scope],
    );
    await db.query(
      "INSERT INTO profs_recipes(scope_id,api_id,name) VALUES($1,90,'Retail recipe')",
      [legacy.scope],
    );
    await db.query(
      "INSERT INTO profs_known_recipes(character_id,scope_id,recipe_id,profession,expansion) VALUES($1,$2,90,'Retail profession','Retail tier')",
      [legacyId, legacy.scope],
    );
    const directory = await service.directory(memberId, false, {});
    expect(directory.characters).toHaveLength(3);
    expect(directory.recipes).toEqual([]);
    expect(directory.characters.every((c) => c.id !== legacyId)).toBe(true);
    await request(app)
      .get('/api/profs/characters/' + legacyId)
      .expect(404);
    const changed = new ProfessionService(
      db,
      { ...settings, profileNamespace: 'profile-other-us' },
      source,
    );
    await expect(changed.ensureScope()).rejects.toThrow('configuration differs');
    await expect(
      new ProfessionService(db, { ...settings, rulesetId: 1 }, source).ensureScope(),
    ).rejects.toThrow('configuration differs');
  });
});
