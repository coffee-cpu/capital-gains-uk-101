#!/usr/bin/env node
/**
 * Builds src/lib/fx/data/hmrcMonthlyArchive.json: HMRC's monthly exchange
 * rates for January 2015 to December 2020.
 *
 * gov.uk (the Trade Tariff service) only publishes monthly files from
 * January 2021, and HMRC's earlier files are no longer online. The app reads
 * 2021 onwards from gov.uk at runtime and these older months from the bundled
 * file, so no third party is trusted at runtime. HMRC never revises a
 * published month, so the file never needs updating.
 *
 * The data comes from hmrc.matchilling.com, a mirror that has copied HMRC's
 * files since 2015. Before writing, the script checks the mirror against
 * gov.uk for every month from 2021, where both exist. When this file was
 * made, every major currency matched exactly; a handful of minor-currency
 * rates differed, where HMRC later corrected its file.
 *
 * Rates that jump far from both neighbouring months and back again are typos
 * (in HMRC's original file or the mirror's copy). They are left out, so a
 * trade in that currency and month gets a clear "rate not found" error
 * instead of a wildly wrong value. They are listed in EXCLUDED below, and the
 * script fails if it finds a new one, so each is reviewed by a person. Spikes
 * that turned out to be real changes are listed in KEPT.
 *
 * Usage: node scripts/vendor-hmrc-monthly-archive.mjs
 */
import { writeFileSync } from 'node:fs'

const FIRST_YEAR = 2015
const LAST_YEAR = 2020
const OUT = new URL('../src/lib/fx/data/hmrcMonthlyArchive.json', import.meta.url)

/** Known typos: month, currency, the value published, and its neighbours */
const EXCLUDED = [
  { month: '2015-04', currency: 'STD', published: 12101.8, note: 'neighbours 33196 and 33371.22' },
  { month: '2015-04', currency: 'IRR', published: 8.8513, note: 'previous months about 42000, not listed after' },
  { month: '2018-04', currency: 'IQD', published: 843.06, note: 'neighbours 1655.06 and 1691.76' },
  { month: '2019-04', currency: 'BRL', published: 439943, note: 'neighbours 4.853 and 5.1227' },
  { month: '2020-02', currency: 'MRO', published: 46.95, note: 'the new MRU rate filed as MRO (redenominated 10:1 in 2018); MRO about 460 before' },
  { month: '2020-04', currency: 'CVE', published: 302.96, note: 'neighbours 132.77 and 126.1' },
  { month: '2020-11', currency: 'STD', published: 274769, note: 'neighbours 26993.9 and 27603.7' },
]

/** Spikes reviewed and kept: real changes, not typos */
const KEPT = [
  {
    month: '2015-01', currency: 'VEF', published: 18.7632,
    note: 'next months about 9.5: Venezuela ran several official rates, and this matches the SICAD rate (about 12.4 VEF/USD) where later months use the official 6.3',
  },
]

const pad = m => String(m).padStart(2, '0')

async function mirrorMonth(year, month) {
  const response = await fetch(`https://hmrc.matchilling.com/rate/${year}/${month}.json`)
  if (!response.ok) throw new Error(`mirror ${year}-${month}: HTTP ${response.status}`)
  const rates = {}
  for (const [code, value] of Object.entries((await response.json()).rates ?? {})) {
    const rate = Number(value)
    if (/^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0) rates[code] = rate
  }
  return rates
}

async function govUkMonth(year, month) {
  const response = await fetch(
    `https://www.trade-tariff.service.gov.uk/api/v2/exchange_rates/files/monthly_csv_${year}-${month}.csv`
  )
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`gov.uk ${year}-${month}: HTTP ${response.status}`)
  const [header, ...rows] = (await response.text()).trim().split('\n').map(line => line.split(','))
  // Country names can contain commas, so read the code and rate from the right
  const fromRight = header.length - header.findIndex(cell => /currency code/i.test(cell))
  const rates = {}
  for (const row of rows) {
    const code = row[row.length - fromRight]
    const rate = Number(row[row.length - fromRight + 1])
    // Fail rather than compare NaN, which would never register a difference
    if (!/^[A-Z]{3}$/.test(code) || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(`gov.uk ${year}-${month}: unreadable row ${JSON.stringify(row)}`)
    }
    rates[code] = rate
  }
  if (Object.keys(rates).length < 100) throw new Error(`gov.uk ${year}-${month}: only ${Object.keys(rates).length} rates`)
  return rates
}

/** Check the mirror against gov.uk wherever both have the month */
async function checkMirrorAgainstGovUk() {
  const majors = ['USD', 'EUR', 'JPY', 'CHF', 'CAD', 'AUD', 'HKD', 'SEK', 'NOK', 'DKK', 'SGD', 'CNY', 'INR']
  const now = new Date()
  let compared = 0
  const differences = []
  for (let year = 2021; year <= now.getFullYear(); year++) {
    for (let m = 1; m <= 12; m++) {
      const month = pad(m)
      const gov = await govUkMonth(year, month)
      if (!gov) continue
      const mirror = await mirrorMonth(year, month).catch(() => null)
      if (!mirror) continue
      for (const [code, rate] of Object.entries(gov)) {
        if (!(code in mirror)) continue
        compared++
        // The mirror sometimes keeps an extra decimal place
        if (Math.abs(mirror[code] / rate - 1) > 1e-5) differences.push(`${year}-${month} ${code}`)
      }
    }
  }
  const majorDifferences = differences.filter(d => majors.includes(d.slice(-3)))
  console.log(`Mirror vs gov.uk: ${compared} rates compared, ${differences.length} differ: ${differences.join(', ') || 'none'}`)
  if (compared < 1000) throw new Error('Too few months to compare; is gov.uk reachable?')
  if (majorDifferences.length > 0) throw new Error(`Major currencies differ: ${majorDifferences.join(', ')}`)
}

/**
 * Rates that leave both neighbours by over 30% while the neighbours agree.
 * The neighbours are the nearest months listing that currency, one on each
 * side, or the nearest two on one side for the first month. `context` holds
 * gov.uk months after the archive, so December 2020 is checked too.
 */
function findSpikes(months, context) {
  const all = { ...months, ...context }
  const keys = Object.keys(all).sort()
  const spikes = []
  for (const month of Object.keys(months)) {
    const i = keys.indexOf(month)
    for (const [code, rate] of Object.entries(months[month])) {
      const has = k => all[k][code] !== undefined
      const before = keys.slice(0, i).reverse().filter(has)
      const after = keys.slice(i + 1).filter(has)
      const [a, b] = before.length && after.length ? [before[0], after[0]] : [...before, ...after].slice(0, 2)
      if (!a || !b) continue
      const [first, second] = [all[a][code], all[b][code]]
      if (Math.abs(rate / first - 1) > 0.3 && Math.abs(second / first - 1) < 0.1) {
        spikes.push({ month, currency: code, published: rate })
      }
    }
  }
  return spikes
}

await checkMirrorAgainstGovUk()

const months = {}
for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
  for (let m = 1; m <= 12; m++) {
    const rates = await mirrorMonth(year, pad(m))
    if (Object.keys(rates).length < 100) throw new Error(`${year}-${pad(m)}: only ${Object.keys(rates).length} rates`)
    months[`${year}-${pad(m)}`] = rates
  }
}

const context = { '2021-01': await govUkMonth(2021, '01'), '2021-02': await govUkMonth(2021, '02') }
const reviewed = [...EXCLUDED, ...KEPT]
const unreviewed = findSpikes(months, context).filter(
  s => !reviewed.some(e => e.month === s.month && e.currency === s.currency && e.published === s.published)
)
if (unreviewed.length > 0) {
  throw new Error(`Unreviewed spikes, check and add to EXCLUDED: ${JSON.stringify(unreviewed)}`)
}
for (const { month, currency } of EXCLUDED) delete months[month][currency]

const archive = {
  about:
    'HMRC monthly exchange rates (currency units per GBP 1), January 2015 to December 2020, ' +
    'copied from the hmrc.matchilling.com mirror of HMRC\'s files. ' +
    'Built by scripts/vendor-hmrc-monthly-archive.mjs, which lists the excluded typos.',
  excluded: EXCLUDED.map(({ month, currency }) => `${month} ${currency}`),
  months,
}
writeFileSync(OUT, JSON.stringify(archive) + '\n')
console.log(`Wrote ${Object.keys(months).length} months to ${OUT.pathname}`)
