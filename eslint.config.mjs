import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/'] },
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
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
