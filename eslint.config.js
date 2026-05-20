// ESLint 9 flat config. Replaces the legacy .eslintrc.json (no longer supported in v9).
//
// Configures:
//   - ES2022 syntax + module sourceType
//   - k6 runtime globals (__ENV, __VU, __ITER, open)
//   - Tight rules around var/const/equality, lenient on console (logger uses it)

import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.es2022,
        // k6 runtime globals — injected by the k6 runtime, not real JS.
        __ENV: 'readonly',
        __VU: 'readonly',
        __ITER: 'readonly',
        open: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
];
