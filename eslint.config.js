import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // tsc already enforces noUnusedLocals/noUnusedParameters; keep ESLint
      // focused on what the compiler can't catch
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // The shared engine runs in the browser and in the CLI (Node), so it
    // must not import browser-only code: UI libraries, the stores, the
    // IndexedDB database or React components. Browser glue that wires the
    // engine to IndexedDB lives in the files excluded here.
    files: [
      'src/lib/**/*.{ts,tsx}',
      'src/utils/**/*.ts',
      'src/types/**/*.ts',
      'src/config/**/*.ts',
      'src/guides/**/*.ts',
      'packages/cli/src/**/*.ts',
    ],
    ignores: ['src/lib/db.ts', 'src/lib/transactionProcessor.ts', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        paths: [
          ...['react', 'react-dom', 'dexie', 'zustand', 'recharts', 'lucide-react'].map(name => ({
            name,
            message: 'Shared engine code must not import browser-only libraries (see CLAUDE.md, packages/cli).',
          })),
          {
            name: '@react-pdf/renderer',
            allowTypeImports: true,
            message: 'The PDF document receives its components as arguments; only the CLI pdf command and the web app load @react-pdf/renderer.',
          },
        ],
        patterns: [{
          regex: '(^|/)(stores|components|hooks)(/|$)|(^|/)db$',
          message: 'Shared engine code must not import the stores, components, hooks or the IndexedDB database.',
        }],
      }],
    },
  },
  {
    files: ['packages/cli/src/commands/pdf.ts'],
    rules: { '@typescript-eslint/no-restricted-imports': 'off' },
  }
)
