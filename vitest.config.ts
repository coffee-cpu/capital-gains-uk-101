import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Most tests are pure logic; files that need a DOM opt in with a
    // `// @vitest-environment jsdom` comment, which keeps the run fast
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
})
