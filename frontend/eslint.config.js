import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^_' }],
      // The auth context object and its `useAuth` accessor live beside the
      // provider that owns them — the conventional React shape, and splitting
      // them buys nothing but an extra fast-refresh round trip in dev.
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true, allowExportNames: ['AuthContext', 'useAuth', 'useColorMode'] },
      ],
    },
  },
  {
    // Test files run under Vitest in jsdom with `globals: true` (see
    // vite.config.js) and reach for Node's `global` to stub fetch.
    files: ['**/*.test.{js,jsx}', 'src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
    rules: {
      // Fast refresh is a dev-server concern; test helpers are never rendered by it.
      'react-refresh/only-export-components': 'off',
    },
  },
])
