import dotenv from 'dotenv';
dotenv.config({ path: new URL('../../../.env', import.meta.url), quiet: true });
export const config = {
  production: process.env.NODE_ENV === 'production',
  origin: process.env.APP_ORIGIN || 'http://localhost:5173',
  port: Number(process.env.PORT || 5000),
  trustProxy: process.env.TRUST_PROXY === 'true',
};
if (config.production) {
  const origin = new URL(config.origin);
  if (!process.env.APP_ORIGIN || origin.protocol !== 'https:' || origin.origin !== config.origin)
    throw new Error(
      'Production requires an exact HTTPS APP_ORIGIN without a path or trailing slash.',
    );
}
