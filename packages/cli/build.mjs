import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// Bundle the CLI and the shared engine (src/lib) into one file with no runtime
// dependencies, so `npx cgt-visualiser` installs quickly. That includes
// @react-pdf/renderer for `--format pdf`; some of its CommonJS dependencies call
// require(), which an ES module doesn't have, so the banner provides one.
await build({
  entryPoints: [new URL('./src/cli.ts', import.meta.url).pathname],
  outfile: new URL('./dist/cli.js', import.meta.url).pathname,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire as __cliCreateRequire } from 'node:module';\nconst require = __cliCreateRequire(import.meta.url);",
  },
  define: {
    __CLI_VERSION__: JSON.stringify(version),
    // Production React (used by the PDF renderer)
    'process.env.NODE_ENV': '"production"',
  },
  // Shrink the download but keep identifiers, so stack traces stay readable
  minifyWhitespace: true,
  minifySyntax: true,
  legalComments: 'linked',
  logLevel: 'warning',
})
