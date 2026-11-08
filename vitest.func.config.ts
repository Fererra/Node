import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// `npm run test:func`: scenario tests and *.pg.test.ts on PostgreSQL
// (standards/checks.md). TEST_DATABASE_URL comes from the environment
// (CI) or from .env (local).
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  test: {
    include: ['test/scenarios/**/*.test.ts', '**/*.pg.test.ts'],
    exclude: ['**/node_modules/**'],
    env: { STORAGE: 'postgres' },
    // One database, so one file at a time.
    fileParallelism: false,
    globalSetup: ['test/support/pg-global-setup.ts'],
    setupFiles: ['test/support/pg-setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
