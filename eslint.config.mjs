import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'reports/', '.stryker-tmp/'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    // NFR-4: errors reach the one global error handler; http and
    // application may throw, but never catch.
    files: ['src/modules/*/http/**/*.ts', 'src/modules/*/application/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TryStatement',
          message:
            'No try in http/ and application/: let errors reach the global error handler (NFR-4).',
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='catch']",
          message:
            'No .catch() in http/ and application/: let errors reach the global error handler (NFR-4).',
        },
      ],
    },
  },
  {
    // Spec 03 AC-1: unit tests import nothing that does I/O.
    files: ['test/unit/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)(shared/db|app|support)(/|$)',
              message:
                'Unit tests do no I/O: no shared/db/, src/app/ or test/support/ (spec 03 AC-1).',
            },
            {
              regex: '^(node:)?(fs|net|child_process|http|https)(/|$)',
              message: 'Unit tests do no I/O (spec 03 AC-1).',
            },
            {
              regex: '^(pg|drizzle-orm|fastify)(/|$)',
              message: 'Unit tests do no I/O (spec 03 AC-1).',
            },
          ],
        },
      ],
    },
  },
  {
    // Spec 03 FR-3, AC-4: E2E tests reach the app only through fetch.
    files: ['test/e2e/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)(src|support)(/|$)',
              message:
                'E2E tests import nothing from src/ or test/support/; use fetch and test/e2e/seed-ids.ts (spec 03 FR-3).',
            },
            {
              regex: '^(pg|drizzle-orm|fastify|@fastify/.*)(/|$)',
              message: 'E2E tests reach the app only through fetch.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
