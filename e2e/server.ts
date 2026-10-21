import '../app/server/src/config.js';
import { openDatabase, migrate } from '../app/server/src/database.js';
import { bootstrap, createPrivateAccount } from '../app/server/src/auth.js';
import { createApp } from '../app/server/src/app.js';
import { ProfessionService } from '../app/server/src/professions.js';
import { blizzardSettings, type BlizzardSource } from '../app/server/src/blizzard.js';
const db = await openDatabase();
await migrate(db);
await bootstrap(db, 'testlead', 'e2e-only-test-password', {
  name: 'The Verdant Guard',
  region: 'us',
  faction: 'alliance',
  ruleset: 'normal',
});
for (const username of ['bru', 'ct', 'peko'])
  await createPrivateAccount(db, username, 'e2e-private-password', {
    name: username + ' raids',
    region: 'us',
    faction: 'alliance',
    ruleset: 'normal',
  });
// Synthetic fixtures exist only in this isolated browser-test server/database.
// No production module imports these or seeds character/recipe ownership.
const fixtureCharacters = [
  { id: 1, name: 'FixtureCrafter', realm: 'area-52', classId: 8 },
  { id: 2, name: 'FixtureAlt', realm: 'other-realm', classId: 13 },
  { id: 3, name: 'FixtureUnfetched', realm: 'area-52', classId: 1 },
];
const fixtureSource: BlizzardSource = {
  configured: true,
  roster: async () => ({ guildId: 1, characters: fixtureCharacters }),
  character: async (realm, name) => ({
    ...fixtureCharacters.find((c) => c.name === name)!,
    realm,
    snapshot: {
      tiers: [
        {
          professionId: 1,
          profession: 'Fixture Alchemy',
          tierId: 10,
          expansion: 'Fixture expansion',
          skill: 50,
          maxSkill: 100,
          recipesAvailable: true,
          recipes: [{ id: 99, name: 'Fixture shared recipe' }],
        },
      ],
    },
  }),
  recipe: async (id) => ({
    id,
    name: 'Fixture shared recipe',
    items: [{ id: 700, name: 'Fixture crafted potion' }],
    reagents: [{ id: 765, name: 'Fixture reagent', quantity: 2 }],
    iconUrl: 'https://render.worldofwarcraft.com/us/icons/56/4620669.jpg',
  }),
};
const professions = new ProfessionService(
  db,
  {
    ...blizzardSettings(),
    gameVersion: 'retail',
    region: 'us',
    profileNamespace: 'profile-us',
    dataNamespace: 'static-us',
    guild: 'TEST FIXTURES',
    admins: ['testlead'],
  },
  fixtureSource,
);
await professions.queue('roster');
await professions.workOne();
const fixtureIds = (
  await db.query<{ id: string }>('SELECT id FROM profs_characters ORDER BY api_id LIMIT 2')
).rows;
for (const c of fixtureIds) {
  await professions.queue('character', c.id);
  await professions.workOne();
}
await professions.workOne();
const server = createApp(db, { professions }).listen(5018, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    server.close(() => {
      db.close().then(() => process.exit(0));
    });
  });
