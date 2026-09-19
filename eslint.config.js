import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'docs/**', 'node_modules/**'] },
  js.configs.recommended,
  { files: ['server/**/*.mjs', 'tests/**/*.mjs', 'vite.config.js'], languageOptions: { globals: globals.node } },
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: globals.browser },
    rules: { 'no-unused-vars': ['error', { caughtErrors: 'none' }] },
  },
];
