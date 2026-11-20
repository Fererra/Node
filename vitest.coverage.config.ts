import { defineConfig } from 'vitest/config';

// `npm run test:coverage`: the in-memory tests outside test/unit/
// (standards/checks.md#test-levels) with the bookings/application branch
// threshold (spec 03 NFR-1).
export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',
      'scripts/**/*.test.mjs',
      'test/scenarios/**/*.test.ts',
      'test/app/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/*.pg.test.ts', '**/*.e2e.test.ts'],
    env: { STORAGE: 'memory' },
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/modules/bookings/application/**/*.ts'],
      exclude: ['**/*.test.ts'],
      reporter: [['text', { skipFull: false }]],
      reportsDirectory: 'coverage/app',
      thresholds: { branches: 90 },
    },
  },
});
