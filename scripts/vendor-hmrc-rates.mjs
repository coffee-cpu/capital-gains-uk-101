#!/usr/bin/env node
/**
 * Bundles HMRC's exchange rates with the app, so past months need no network
 * request (privacy, speed, offline use, and no gov.uk rate limits):
 *
 * - src/lib/fx/data/hmrcMonthly/YYYY.json: monthly rates, one file per year,
 *   each loaded only when a transaction falls in that year
 * - src/lib/fx/data/hmrcMonthly/index.ts: generated loaders and the last
 *   bundled month (the app reads later months from gov.uk)
 * - src/lib/fx/data/hmrcYearly.json: yearly average rates
 *
 * Sources:
 * - January 2021 onwards: the CSV files HMRC publishes on gov.uk (Trade
 *   Tariff service), parsed with the app's own parser (govUkCsv.ts).
 * - 2015 to 2020: gov.uk has no files for these months. They were copied once
 *   from hmrc.matchilling.com, a mirror of HMRC's files, after checking the
 *   mirror against gov.uk wherever both exist. They're kept as they are unless
 *   --rebuild-archive is passed, which copies and checks them again.
 *
 * Rates that jump far from both neighbouring months and back again are typos
 * (in HMRC's file or the mirror's copy). They are left out, so a trade in that
 * currency and month gets a clear "rate not found" error instead of a wildly
 * wrong value. They are listed in EXCLUDED, and the script fails if it finds
 * a new one, so each is reviewed by a person. Spikes that turned out to be
 * real changes are listed in KEPT.
 *
 * HMRC has occasionally corrected a published file, so every run fetches all
 * gov.uk months again and reports any bundled rate that changed.
 *
 * Usage: node scripts/vendor-hmrc-rates.mjs [--rebuild-archive] [--report report.md]
 * Run from .github/workflows/update-hmrc-rates.yml, which opens a PR with the
 * report when anything changed.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { parseGovUkRatesCsv } from '../src/lib/fx/providers/govUkCsv.ts'

const MONTHLY_DIR = new URL('../src/lib/fx/data/hmrcMonthly/', import.meta.url)
const YEARLY_FILE = new URL('../src/lib/fx/data/hmrcYearly.json', import.meta.url)
const FIRST_ARCHIVE_YEAR = 2015
const FIRST_GOV_UK_YEAR = 2021
const FIRST_YEARLY_YEAR = 2020
/** A real monthly file lists 140+ currencies */
const MIN_MONTHLY_RATES = 100
/** Yearly files before 2023 have no codes, and only ~40 country names map to one */
const MIN_YEARLY_RATES = 30

/** Known typos: month, currency, the value published, and its neighbours */
const EXCLUDED = [
  { month: '2015-04', currency: 'STD', published: 12101.8, note: 'neighbours 33196 and 33371.22' },
  { month: '2015-04', currency: 'IRR', published: 8.8513, note: 'previous months about 42000, not listed after' },
  { month: '2018-04', currency: 'IQD', published: 843.06, note: 'neighbours 1655.06 and 1691.76' },
  { month: '2019-04', currency: 'BRL', published: 439943, note: 'neighbours 4.853 and 5.1227' },
  { month: '2020-02', currency: 'MRO', published: 46.95, note: 'the new MRU rate filed as MRO (redenominated 10:1 in 2018); MRO about 460 before' },
  { month: '2020-04', currency: 'CVE', published: 302.96, note: 'neighbours 132.77 and 126.1' },
  { month: '2020-11', currency: 'STD', published: 274769, note: 'neighbours 26993.9 and 27603.7' },
  // In HMRC's current gov.uk files
  { month: '2022-03', currency: 'KHR', published: 3041.7012, note: 'neighbours 5550.4068 and 5346.88' },
  { month: '2022-11', currency: 'SLE', published: 15631.1792, note: 'the old SLL rate filed as SLE (redenominated 1000:1 in July 2022); SLE not listed around it' },
  { month: '2023-02', currency: 'SLL', published: 23.6617, note: 'the new SLE rate filed as SLL; SLL about 17000 before' },
  { month: '2023-02', currency: 'HRK', published: 1.1441, note: "that month's EUR rate filed as HRK (Croatia adopted the euro in January 2023); HRK about 8.78 before" },
]

/** Spikes reviewed and kept: real changes, not typos */
const KEPT = [
  {
    month: '2015-01', currency: 'VEF', published: 18.7632,
    note: 'next months about 9.5: Venezuela ran several official rates, and this matches the SICAD rate (about 12.4 VEF/USD) where later months use the official 6.3',
  },
]

const args = process.argv.slice(2)
const rebuildArchive = args.includes('--rebuild-archive')
const reportPath = args.includes('--report') ? args[args.indexOf('--report') + 1] : null

const pad = m => String(m).padStart(2, '0')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * GET with pacing, and retries when gov.uk rate-limits (HTTP 429, about a
 * minute, with no Retry-After header)
 */
async function get(url) {
  for (let attempt = 1; ; attempt++) {
    await sleep(150)
    const response = await fetch(url)
    if (response.status !== 429) return response
    if (attempt === 5) throw new Error(`${url}: still rate-limited after ${attempt} attempts`)
    console.log(`Rate-limited by ${new URL(url).host}; waiting 70s (attempt ${attempt})`)
    await sleep(70_000)
  }
}

async function govUkFile(name, minRates) {
  const url = `https://www.trade-tariff.service.gov.uk/api/v2/exchange_rates/files/${name}`
  const response = await get(url)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
  return parseGovUkRatesCsv(await response.text(), minRates)
}

async function mirrorMonth(year, month) {
  const response = await get(`https://hmrc.matchilling.com/rate/${year}/${month}.json`)
  if (!response.ok) throw new Error(`mirror ${year}-${month}: HTTP ${response.status}`)
  const rates = {}
  for (const [code, value] of Object.entries((await response.json()).rates ?? {})) {
    const rate = Number(value)
    if (/^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0) rates[code] = rate
  }
  if (Object.keys(rates).length < MIN_MONTHLY_RATES) throw new Error(`mirror ${year}-${month}: only ${Object.keys(rates).length} rates`)
  return rates
}

/** Every gov.uk monthly file from January 2021 up to the latest published */
async function fetchGovUkMonths() {
  const months = {}
  const now = new Date()
  // HMRC publishes a month's file shortly before it starts, so look one ahead
  const last = `${now.getFullYear() + (now.getMonth() === 11 ? 1 : 0)}-${pad(((now.getMonth() + 1) % 12) + 1)}`
  for (let year = FIRST_GOV_UK_YEAR; `${year}-01` <= last; year++) {
    for (let m = 1; m <= 12 && `${year}-${pad(m)}` <= last; m++) {
      const rates = await govUkFile(`monthly_csv_${year}-${pad(m)}.csv`, MIN_MONTHLY_RATES)
      if (rates) months[`${year}-${pad(m)}`] = rates
      else if (`${year}-${pad(m)}` < `${now.getFullYear()}-${pad(now.getMonth() + 1)}`) {
        throw new Error(`gov.uk has no file for ${year}-${pad(m)}, a past month`)
      }
    }
  }
  return months
}

/** Check the mirror against gov.uk wherever both have the month */
async function checkMirrorAgainstGovUk(govMonths) {
  const majors = ['USD', 'EUR', 'JPY', 'CHF', 'CAD', 'AUD', 'HKD', 'SEK', 'NOK', 'DKK', 'SGD', 'CNY', 'INR']
  let compared = 0
  const differences = []
  for (const [key, gov] of Object.entries(govMonths)) {
    const mirror = await mirrorMonth(...key.split('-')).catch(() => null)
    if (!mirror) continue
    for (const [code, rate] of Object.entries(gov)) {
      if (!(code in mirror)) continue
      compared++
      // The mirror sometimes keeps an extra decimal place
      if (Math.abs(mirror[code] / rate - 1) > 1e-5) differences.push(`${key} ${code}`)
    }
  }
  const majorDifferences = differences.filter(d => majors.includes(d.slice(-3)))
  console.log(`Mirror vs gov.uk: ${compared} rates compared, ${differences.length} differ: ${differences.join(', ') || 'none'}`)
  if (compared < 1000) throw new Error('Too few months to compare; is the mirror reachable?')
  if (majorDifferences.length > 0) throw new Error(`Major currencies differ: ${majorDifferences.join(', ')}`)
}

/**
 * Rates that leave both neighbours by over 30% while the neighbours agree.
 * The neighbours are the nearest months listing that currency, one on each
 * side, or the nearest two on one side for the first and last months.
 * Those edge months can't tell a typo from a real devaluation (the newest
 * month has no later one yet), so their spikes are marked `edge`.
 */
function findSpikes(months) {
  const keys = Object.keys(months).sort()
  const spikes = []
  keys.forEach((month, i) => {
    for (const [code, rate] of Object.entries(months[month])) {
      const has = k => months[k][code] !== undefined
      const before = keys.slice(0, i).reverse().filter(has)
      const after = keys.slice(i + 1).filter(has)
      const edge = !(before.length && after.length)
      const [a, b] = edge ? [...before, ...after].slice(0, 2) : [before[0], after[0]]
      if (!a || !b) continue
      const [first, second] = [months[a][code], months[b][code]]
      if (Math.abs(rate / first - 1) > 0.3 && Math.abs(second / first - 1) < 0.1) {
        spikes.push({ month, currency: code, published: rate, edge })
      }
    }
  })
  return spikes
}

/** The monthly rates bundled now, by month */
function readBundledMonths() {
  const months = {}
  if (!existsSync(MONTHLY_DIR)) return months
  for (const file of readdirSync(MONTHLY_DIR).filter(f => /^\d{4}\.json$/.test(f))) {
    Object.assign(months, JSON.parse(readFileSync(new URL(file, MONTHLY_DIR), 'utf8')).months)
  }
  return months
}

/** Markdown lines describing what changed between two { period: rates } maps */
function describeChanges(label, before, after) {
  const lines = []
  const added = Object.keys(after).filter(k => !before[k]).sort()
  if (added.length) lines.push(`- ${label} added: ${added.join(', ')}`)
  for (const key of Object.keys(after).filter(k => before[k]).sort()) {
    const codes = new Set([...Object.keys(before[key]), ...Object.keys(after[key])])
    const changed = [...codes].filter(c => before[key][c] !== after[key][c]).sort()
    for (const c of changed) {
      lines.push(`- **${label} ${key} ${c} changed: ${before[key][c] ?? 'none'} → ${after[key][c] ?? 'none'}** (HMRC corrected its file?)`)
    }
  }
  const removed = Object.keys(before).filter(k => !after[k])
  if (removed.length) lines.push(`- **${label} removed: ${removed.join(', ')}**`)
  return lines
}

// --- Monthly rates -----------------------------------------------------------

const bundled = readBundledMonths()
const govMonths = await fetchGovUkMonths()
console.log(`gov.uk: ${Object.keys(govMonths).length} monthly files`)

let archiveMonths = Object.fromEntries(Object.entries(bundled).filter(([k]) => k < `${FIRST_GOV_UK_YEAR}-01`))
if (rebuildArchive || Object.keys(archiveMonths).length === 0) {
  await checkMirrorAgainstGovUk(govMonths)
  archiveMonths = {}
  for (let year = FIRST_ARCHIVE_YEAR; year < FIRST_GOV_UK_YEAR; year++) {
    for (let m = 1; m <= 12; m++) archiveMonths[`${year}-${pad(m)}`] = await mirrorMonth(year, pad(m))
  }
}

const months = { ...archiveMonths, ...govMonths }
const reviewed = [...EXCLUDED, ...KEPT]
const unreviewed = findSpikes(months).filter(
  s => !reviewed.some(e => e.month === s.month && e.currency === s.currency && e.published === s.published)
)
// An interior spike fails the run until someone reviews it. An edge spike is
// only reported: failing would hold back every other currency's new month
// for what is often a real devaluation, and it becomes interior (and fails,
// if it's a typo) once the next month is published
const interior = unreviewed.filter(s => !s.edge)
if (interior.length > 0) {
  throw new Error(`Unreviewed spikes, check each and add it to EXCLUDED or KEPT: ${JSON.stringify(interior.map(({ edge, ...s }) => s))}`)
}
const edgeSpikes = unreviewed.filter(s => s.edge)
for (const { month, currency } of EXCLUDED) delete months[month]?.[currency]

const years = [...new Set(Object.keys(months).map(k => k.slice(0, 4)))].sort()
for (const year of years) {
  const yearMonths = Object.fromEntries(Object.entries(months).filter(([k]) => k.startsWith(year)).sort())
  writeFileSync(new URL(`${year}.json`, MONTHLY_DIR), JSON.stringify({ months: yearMonths }) + '\n')
}
const lastMonth = Object.keys(months).sort().at(-1)
writeFileSync(new URL('index.ts', MONTHLY_DIR), `// Generated by scripts/vendor-hmrc-rates.mjs: do not edit.

/** One year of HMRC monthly rates: currency units per £1, by month and currency */
export interface BundledYear {
  months: Record<string, Record<string, number>>
}

/** First bundled month (from the 2015-2020 archive) */
export const FIRST_BUNDLED_MONTH = '${Object.keys(months).sort()[0]}'

/** Last bundled month. The app reads later months from gov.uk */
export const LAST_BUNDLED_MONTH = '${lastMonth}'

/**
 * Typos left out of HMRC's published rates (see the script): a transaction in
 * one of these gets a clear "not found" error instead of a wildly wrong value
 */
export const EXCLUDED_RATES = ${JSON.stringify(EXCLUDED.map(({ month, currency }) => `${month} ${currency}`))}

/** Each year is a separate chunk in the web build, loaded only when needed */
export const BUNDLED_MONTHLY_YEARS: Record<string, () => Promise<{ default: BundledYear }>> = {
${years.map(y => `  '${y}': () => import('./${y}.json'),`).join('\n')}
}
`)
console.log(`Wrote ${Object.keys(months).length} months (${years[0]}-${lastMonth}) to ${MONTHLY_DIR.pathname}`)

// --- Yearly average rates -----------------------------------------------------

const bundledYearly = existsSync(YEARLY_FILE) ? JSON.parse(readFileSync(YEARLY_FILE, 'utf8')).years : {}
const yearly = {}
for (let year = FIRST_YEARLY_YEAR; year <= new Date().getFullYear(); year++) {
  // The December file (calendar year) is final; until it's out, the March
  // file (April to March) stands in, and the app still checks gov.uk for December
  const december = await govUkFile(`average_csv_${year}-12.csv`, MIN_YEARLY_RATES)
  const march = december ? null : await govUkFile(`average_csv_${year}-3.csv`, MIN_YEARLY_RATES)
  if (december || march) yearly[year] = { file: december ? 'December' : 'March', rates: december ?? march }
}
writeFileSync(YEARLY_FILE, JSON.stringify({
  about: 'HMRC yearly average rates (currency units per £1) from gov.uk. Built by scripts/vendor-hmrc-rates.mjs.',
  years: yearly,
}) + '\n')
console.log(`Wrote yearly averages for ${Object.keys(yearly).join(', ')}`)

// --- Report -----------------------------------------------------------------

const changes = [
  ...describeChanges('Monthly', bundled, months),
  ...describeChanges('Yearly', Object.fromEntries(Object.entries(bundledYearly).map(([y, v]) => [y, v.rates])),
    Object.fromEntries(Object.entries(yearly).map(([y, v]) => [y, v.rates]))),
]
const warnings = edgeSpikes.map(({ month, currency, published }) =>
  `- **Check ${month} ${currency} ${published}**: over 30% from the previous months. A real move, or a typo to add to EXCLUDED`)
const report = (changes.length
  ? `HMRC exchange rates changed on gov.uk:\n\n${changes.join('\n')}\n`
  : 'No changes.\n') +
  (warnings.length ? `\nPossible typos in the newest month (the run fails next month if they look wrong then):\n\n${warnings.join('\n')}\n` : '')
console.log(report)
if (reportPath) writeFileSync(reportPath, report)
