import { expect, it } from 'vitest';
import { postgresOptions } from './postgres.js';
const DATABASE_URL = 'postgres://test:test@localhost/planner_test';
it('requires verified TLS in production even if a connection URL requests weaker verification', async () => {
  const options = await postgresOptions({
    NODE_ENV: 'production',
    DATABASE_URL: DATABASE_URL + '?sslmode=require',
  });
  expect(options.ssl).toMatchObject({ rejectUnauthorized: true });
  expect(options.connectionString).not.toContain('sslmode');
  await expect(
    postgresOptions({ NODE_ENV: 'production', DATABASE_URL: DATABASE_URL + '?sslmode=disable' }),
  ).rejects.toThrow('verified TLS');
  await expect(
    postgresOptions({ NODE_ENV: 'production', DATABASE_URL, DATABASE_SSL: 'false' }),
  ).rejects.toThrow('verified TLS');
  await expect(
    postgresOptions({ NODE_ENV: 'production', DATABASE_URL, PGSSLMODE: 'no-verify' }),
  ).rejects.toThrow('verification');
});
it('allows the local test database while honoring explicit verified TLS', async () => {
  expect((await postgresOptions({ DATABASE_URL })).ssl).toBe(false);
  expect((await postgresOptions({ DATABASE_URL, DATABASE_SSL: 'true' })).ssl).toMatchObject({
    rejectUnauthorized: true,
  });
});
