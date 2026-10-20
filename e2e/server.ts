import '../app/server/src/config.js';
import { openDatabase, migrate } from '../app/server/src/database.js';
import { bootstrap, createPrivateAccount } from '../app/server/src/auth.js';
import { createApp } from '../app/server/src/app.js';
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
const server = createApp(db).listen(5018, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    server.close(() => {
      db.close().then(() => process.exit(0));
    });
  });
