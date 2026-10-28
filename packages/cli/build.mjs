import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// Bundle the CLI and the shared engine (src/lib) into one file with no runtime
// dependencies, so `npx cgt-visualiser` installs quickly.
await build({
  entryPoints: [new URL('./src/cli.ts', import.meta.url).pathname],
  outfile: new URL('./dist/cli.js', import.meta.url).pathname,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  define: { __CLI_VERSION__: JSON.stringify(version) },
  legalComments: 'linked',
  logLevel: 'warning',
})
