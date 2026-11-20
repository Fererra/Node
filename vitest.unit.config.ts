import { defineConfig } from 'vitest/config';

// `npm run test:unit`: unit tests only (spec 03 FR-1, NFR-1). Coverage
// counts only the FR-1 files, so files they import (e.g. shared/errors.ts)
// don't count; every one of them must reach 100 % on its own.
export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      include: [
        'src/modules/bookings/domain/**/*.ts',
        'src/shared/retry.ts',
        'src/shared/kernel/**/*.ts',
      ],
      exclude: ['**/*.test.ts'],
      reporter: [['text', { skipFull: false }]],
      reportsDirectory: 'coverage/unit',
      thresholds: { perFile: true, branches: 100, functions: 100 },
    },
  },
});
