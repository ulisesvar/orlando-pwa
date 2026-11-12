import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Usar textContent o createElement (ASVS V1.2.1/V3.2.2).' },
        { property: 'outerHTML', message: 'No insertar HTML.' },
        { property: 'insertAdjacentHTML', message: 'No insertar HTML.' },
      ],
    },
  },
  { files: ['src/sw.js'], languageOptions: { globals: globals.serviceworker } },
  { files: ['scripts/**', 'tests/**', '*.config.*'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];
