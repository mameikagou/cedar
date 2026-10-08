import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'src/routeTree.gen.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true, allowExportNames: ['Route'] }],
    },
  },
  { files: ['**/*.mjs'], languageOptions: { globals: globals.node } },
  {
    files: ['src/routes/**/*.tsx'],
    // TanStack's Rspack plugin owns route module refresh and code splitting.
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['src/routes/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['@/api/*'], message: 'Use hooks/api at the route layer; components receive data through props.' },
        { group: ['*.css', '**/*.css'], message: 'Business components must use Tailwind; CSS is only for global configuration.' },
      ] }],
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Network requests belong in api/client.' }],
    },
  },
)
