import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['app/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
