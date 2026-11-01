#!/usr/bin/env bash
# Runs the bundled CLI on the HMRC HS284 example 3 fixture (GBP only, no network)
# and checks its JSON and PDF output. Run from the repository root after
# `npm run build:cli`.
set -euo pipefail

cli=packages/cli/dist/cli.js
fixture=e2e/fixtures/hmrc-hs284-example3.csv
flags=(--tax-year 2024/25 --offline --no-auto-splits --no-cache --strict)
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT

node "$cli" calculate "$fixture" "${flags[@]}" --format json > "$out/report.json"
node -e "
  const r = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))
  const net = r.taxYears[0].netGainOrLossGbp
  if (net !== 629.67) { console.error('Expected net gain 629.67, got', net); process.exit(1) }
  console.log('CLI smoke test passed on', process.version, '- net gain', net)
" "$out/report.json"

# The PDF renderer is bundled too: check it runs from the built file
node "$cli" calculate "$fixture" "${flags[@]}" --format pdf -o "$out/report.pdf"
head -c 5 "$out/report.pdf" | grep -q '%PDF-' || { echo 'Expected a PDF file'; exit 1; }
