#!/usr/bin/env node
/**
 * Rebuilds the example report shown before anything is imported (the
 * "What you get" card): a PDF made from the sample portfolio, which is made-up
 * data, and a JPEG of its first page.
 *
 *   npm run build:example-report
 *
 * Run it after changing the PDF report's layout. Rendering page 1 needs
 * `sips` (built into macOS) or `pdftoppm` (poppler-utils on Linux).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TAX_YEAR = '2025/26'
const SAMPLE = 'public/examples/schwab-transactions-example.csv'
const BASE = `public/examples/example-report-${TAX_YEAR.replace('/', '-')}`
const CLI = 'packages/cli/dist/cli.js'
// The longer side of the preview, in pixels: sharp at the card's size on a phone
const IMAGE_SIZE = 1000

function hasCommand(name) {
  try {
    execFileSync('which', [name], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (!existsSync(CLI)) {
  console.error(`${CLI} not found: run npm run build:cli first`)
  process.exit(1)
}

// Bundled exchange rates only and no fetched split data, so a rebuild doesn't
// depend on the network
execFileSync('node', [
  CLI, 'calculate', SAMPLE,
  '--tax-year', TAX_YEAR, '--offline', '--no-auto-splits',
  '--format', 'pdf', '-o', `${BASE}.pdf`,
], { stdio: 'inherit' })

if (hasCommand('sips')) {
  execFileSync('sips', [
    '-s', 'format', 'jpeg', '-s', 'formatOptions', '72',
    '-Z', String(IMAGE_SIZE), `${BASE}.pdf`, '--out', `${BASE}.jpg`,
  ], { stdio: 'ignore' })
} else if (hasCommand('pdftoppm')) {
  const dir = mkdtempSync(join(tmpdir(), 'example-report-'))
  execFileSync('pdftoppm', [
    '-jpeg', '-jpegopt', 'quality=72', '-f', '1', '-l', '1',
    '-scale-to', String(IMAGE_SIZE), `${BASE}.pdf`, join(dir, 'page'),
  ])
  const [page] = readdirSync(dir)
  renameSync(join(dir, page), `${BASE}.jpg`)
  rmSync(dir, { recursive: true, force: true })
} else {
  console.error('Need sips (macOS) or pdftoppm (poppler-utils) to render the preview image')
  process.exit(1)
}

console.log(`Wrote ${BASE}.pdf and ${BASE}.jpg`)
