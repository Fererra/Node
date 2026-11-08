import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts', 'scripts/**/*.test.mjs'],
    // Tests that need PostgreSQL run with `npm run test:func` (DB stage).
    exclude: ['**/node_modules/**', '**/*.pg.test.ts'],
  },
});
