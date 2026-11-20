// `npm run mutation` (= `make mutation`): spec 03 FR-5, NFR-2, ADR-0005.
// Mutants are never hidden: no `// Stryker disable` comments, no
// `mutator.excludedMutations` and no ignorers. Survivors are classified in
// docs/mutation.md.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: [
    'src/modules/bookings/domain/**/*.ts',
    'src/modules/bookings/application/**/*.ts',
    'src/shared/retry.ts',
    'src/shared/kernel/**/*.ts',
    '!**/*.test.ts',
  ],
  // The `npm test` set: unit and in-memory tests, no database.
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  thresholds: { high: 90, low: 80, break: 80 },
  // Generated folders only (standards/checks.md#test-levels).
  ignorePatterns: ['dist', 'coverage', 'reports'],
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
};
