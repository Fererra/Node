import { defineConfig } from 'vitest/config';

// `npm test` and Stryker: unit and in-memory tests (standards/checks.md).
// PostgreSQL tests run with `npm run test:func`, E2E with `npm run test:e2e`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts', 'scripts/**/*.test.mjs'],
    exclude: ['**/node_modules/**', '**/*.pg.test.ts', '**/*.e2e.test.ts'],
  },
});
