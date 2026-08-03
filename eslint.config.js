import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        // `projectService` (typescript-eslint 8+) descobre sozinho qual
        // tsconfig cobre cada arquivo (tsconfig.app.json para src/,
        // tsconfig.node.json para api/ e scripts/) — Fase 7, habilita
        // regras type-aware (ex: no-floating-promises, no-misused-promises).
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Handler assíncrono em onClick/onChange etc. é o padrão predominante
      // deste projeto (toast.loading → await → toast.success/error) — React
      // ignora o Promise retornado, não é um bug. `attributes: false` é a
      // opção documentada do próprio typescript-eslint para esse caso.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
    },
  },
])
