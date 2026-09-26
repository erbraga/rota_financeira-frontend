import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

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
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Componentes importados só em JSX aparecem como "não usados" sem esta exceção.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', ignoreRestSiblings: true }],
    },
  },
  {
    // Configuração e ferramentas rodam em Node.
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Testes e mocks rodam em Node (Vitest com globais e MSW).
    files: ['src/**/*.test.{js,jsx}', 'src/setupTests.js', 'src/testUtils.jsx', 'src/mocks/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },
  {
    // Utilitário de teste: exporta funções de renderização, não componentes.
    files: ['src/testUtils.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
