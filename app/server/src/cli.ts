import './config.js';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { workspaceSchema } from '@spf/shared';
import { openDatabase, migrate } from './database.js';
import { bootstrap, createPrivateAccount, accountCredentials, hashPassword } from './auth.js';
import { exportDatabase, restoreDatabase } from './transfer.js';
const db = await openDatabase();
try {
  await migrate(db);
  if (process.argv[2] === 'export-database') {
    const directory = new URL('../../../.local/', import.meta.url);
    await mkdir(directory, { recursive: true });
    const filename = process.env.DB_EXPORT_FILE
      ? resolve(process.env.DB_EXPORT_FILE)
      : fileURLToPath(new URL('database-transfer-' + Date.now() + '.json', directory));
    const snapshot = await exportDatabase(db);
    await writeFile(filename, JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
    console.log(
      'Private database transfer saved to ' +
        filename +
        '. It contains password hashes; keep it private.',
    );
  } else if (process.argv[2] === 'restore-database') {
    if (!process.env.DB_IMPORT_FILE)
      throw new Error('DB_IMPORT_FILE must point to a private database transfer file.');
    const filename = resolve(process.env.DB_IMPORT_FILE);
    if ((await stat(filename)).size > 100 * 1024 * 1024)
      throw new Error('Database transfer file exceeds 100 MB.');
    const counts = await restoreDatabase(db, JSON.parse(await readFile(filename, 'utf8')));
    console.log('Database transfer committed and verified: ' + JSON.stringify(counts));
  } else if (process.argv[2] === 'bootstrap') {
    const { username, password } = accountCredentials.parse({
      username: process.env.BOOTSTRAP_USERNAME,
      password: process.env.BOOTSTRAP_PASSWORD,
    });
    const workspace = workspaceSchema.parse({
      name: process.env.BOOTSTRAP_GUILD_NAME,
      region: process.env.BOOTSTRAP_REGION || 'us',
      ruleset: process.env.BOOTSTRAP_RULESET || 'normal',
      faction: process.env.BOOTSTRAP_FACTION || 'alliance',
    });
    await bootstrap(db, username, password, workspace);
    console.log(
      'Owner and raid workspace created. Sign in, then remove BOOTSTRAP_PASSWORD from .env.',
    );
  } else if (process.argv[2] === 'create-account') {
    const { username, password } = accountCredentials.parse({
      username: process.env.ACCOUNT_USERNAME,
      password: process.env.ACCOUNT_PASSWORD,
    });
    await createPrivateAccount(
      db,
      username,
      password,
      workspaceSchema.parse({
        name: username + ' raids',
        region: process.env.BOOTSTRAP_REGION || 'us',
        ruleset: process.env.BOOTSTRAP_RULESET || 'normal',
        faction: process.env.BOOTSTRAP_FACTION || 'alliance',
      }),
    );
    console.log('Private account created. Remove ACCOUNT_PASSWORD from .env.');
  } else if (process.argv[2] === 'seed-accounts') {
    const pending: { username: string; password: string }[] = [];
    for (const username of ['bru', 'ct', 'peko']) {
      const existing = await db.query('SELECT id FROM users WHERE lower(username)=$1', [username]);
      if (existing.rows.length) console.log(username + ': already exists, unchanged.');
      else pending.push({ username, password: 'Rewound-' + randomBytes(12).toString('base64url') });
    }
    if (pending.length) {
      const directory = new URL('../../../.local/', import.meta.url);
      await mkdir(directory, { recursive: true });
      const credentialsFile = new URL('rewound-logins-' + Date.now() + '.txt', directory);
      await writeFile(
        credentialsFile,
        'Rewound private accounts\nKeep this file private. Send each person only their own login.\n\n' +
          pending.map((a) => a.username + '\t' + a.password).join('\n') +
          '\n',
        { flag: 'wx', mode: 0o600 },
      );
      for (const account of pending) {
        await createPrivateAccount(
          db,
          account.username,
          account.password,
          workspaceSchema.parse({
            name: account.username + ' raids',
            region: process.env.BOOTSTRAP_REGION || 'us',
            ruleset: process.env.BOOTSTRAP_RULESET || 'normal',
            faction: process.env.BOOTSTRAP_FACTION || 'alliance',
          }),
        );
        console.log(account.username + ': private planner created.');
      }
      console.log('Login details saved to ' + fileURLToPath(credentialsFile));
    } else console.log('All three accounts already exist. No passwords or rosters were changed.');
  } else if (process.argv[2] === 'reset-password') {
    const { username, password } = accountCredentials.parse({
      username: process.env.RESET_USERNAME,
      password: process.env.RESET_PASSWORD,
    });
    const hashed = await hashPassword(password);
    await db.transaction(async (tx) => {
      const user = (
        await tx.query<{ id: string }>(
          'UPDATE users SET password_hash=$1 WHERE username=$2 RETURNING id',
          [hashed, username],
        )
      ).rows[0];
      if (!user) throw new Error('Account not found.');
      await tx.query('DELETE FROM sessions WHERE user_id=$1', [user.id]);
    });
    console.log('Password reset and all sessions revoked. Remove RESET_PASSWORD from .env.');
  } else if (process.argv[2] === 'migrate') console.log('Database migrations are up to date.');
  else
    throw new Error(
      'Expected migrate, bootstrap, create-account, seed-accounts, reset-password, export-database, or restore-database.',
    );
} catch (error) {
  console.error(
    error instanceof z.ZodError
      ? 'Check account fields in .env: username (2–40 letters/numbers/._-), password (12–128 characters), and planner name (2–80 characters).'
      : (error as Error).message,
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
