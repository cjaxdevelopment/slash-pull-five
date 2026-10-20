import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const database = `.local/e2e-${randomUUID()}`;
const env = {
  DATABASE_MODE: 'local',
  DATABASE_DIRECTORY: database,
  NODE_ENV: 'development',
  PORT: '5018',
  APP_ORIGIN: 'http://localhost:5178',
  BOOTSTRAP_USERNAME: 'testlead',
  BOOTSTRAP_PASSWORD: 'e2e-only-test-password',
  BOOTSTRAP_GUILD_NAME: 'The Verdant Guard',
  BOOTSTRAP_REGION: 'us',
  BOOTSTRAP_FACTION: 'alliance',
  BOOTSTRAP_RULESET: 'normal',
};
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5178',
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node --import tsx e2e/server.ts',
      url: 'http://127.0.0.1:5018/api/health',
      env,
      timeout: 60000,
    },
    {
      command:
        'node node_modules/vite/bin/vite.js app/client --config app/client/vite.config.ts --host 127.0.0.1 --port 5178 --strictPort',
      url: 'http://localhost:5178',
      env: { API_PORT: '5018' },
      timeout: 30000,
    },
  ],
});
