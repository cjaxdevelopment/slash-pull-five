import { readFile } from 'node:fs/promises';
import type { PoolConfig } from 'pg';

export async function postgresOptions(env: NodeJS.ProcessEnv = process.env): Promise<PoolConfig> {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const url = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  const mode = url.searchParams.get('sslmode');
  if (mode === 'no-verify' || env.PGSSLMODE === 'no-verify')
    throw new Error('Database certificate verification must remain enabled.');
  const production = env.NODE_ENV === 'production';
  if (production && (env.DATABASE_SSL === 'false' || mode === 'disable'))
    throw new Error('Production database connections require verified TLS.');
  const tls = production || env.DATABASE_SSL === 'true' || (mode !== null && mode !== 'disable');
  const caFile = env.DATABASE_SSL_CA_FILE || url.searchParams.get('sslrootcert');
  if (url.searchParams.has('sslcert') || url.searchParams.has('sslkey'))
    throw new Error('Client-certificate database connections require explicit configuration.');
  // pg URL SSL options replace the explicit ssl object. Normalize them first so CA and hostname checks survive.
  for (const key of ['sslmode', 'sslrootcert']) url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    max: 5,
    connectionTimeoutMillis: 15000,
    ssl: tls
      ? { rejectUnauthorized: true, ...(caFile ? { ca: await readFile(caFile, 'utf8') } : {}) }
      : false,
  };
}
