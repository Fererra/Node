import { defineConfig } from 'vitest/config';

// `npm run test:e2e`: E2E tests against a running server on port 3100
// (spec 03 FR-3). scripts/test-all.mjs migrates and seeds the E2E database
// and starts the server first.
export default defineConfig({
  test: {
    include: ['test/e2e/**/*.e2e.test.ts'],
    exclude: ['**/node_modules/**'],
    testTimeout: 15_000,
  },
});
