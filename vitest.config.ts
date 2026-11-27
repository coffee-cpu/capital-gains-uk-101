import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

/**
 * A plain `.ttf` import is a data URL, as in the CLI's esbuild bundle
 * (packages/cli/build.mjs), so CLI tests can render its PDF from source.
 * The web app imports fonts with `?url` instead, which this leaves alone.
 */
function ttfAsDataUrl(): Plugin {
  return {
    name: 'ttf-as-data-url',
    // Before Vite's asset plugin, which would turn it into a URL path
    enforce: 'pre',
    load(id) {
      if (!id.endsWith('.ttf')) return null
      const base64 = readFileSync(id).toString('base64')
      return `export default ${JSON.stringify(`data:font/ttf;base64,${base64}`)}`
    },
  }
}

export default defineConfig({
  plugins: [react(), ttfAsDataUrl()],
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  test: {
    // Most tests are pure logic; files that need a DOM opt in with a
    // `// @vitest-environment jsdom` comment, which keeps the run fast
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
})
