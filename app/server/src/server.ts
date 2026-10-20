import { config } from './config.js';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDatabase, migrate } from './database.js';

const db = await openDatabase();
await migrate(db);
const app = createApp(db);
if (config.production) {
  const client = fileURLToPath(new URL('../../client/dist/', import.meta.url));
  app.use(express.static(client, { index: false }));
  app.get('/{*path}', (_req, res) => res.sendFile(`${client}index.html`));
}
const server = app.listen(config.port, config.production ? '0.0.0.0' : '127.0.0.1', () =>
  console.log(`Forever roster API listening on port ${config.port}`),
);
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(() => {
      db.close()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
  });
