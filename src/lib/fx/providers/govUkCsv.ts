import Papa from 'papaparse'

/** Currency units per £1, keyed by ISO 4217 code */
export type GovUkRates = Record<string, number>

/**
 * Parse an HMRC exchange-rate CSV from gov.uk (Trade Tariff service): the
 * monthly files and both yearly average formats.
 *
 * Columns are found by header, so their order doesn't matter:
 * - rate: "Currency Units per £1" / "Currency Units per pound"
 * - code: "Currency Code". Yearly files before 2023 have no code column;
 *   their country names are mapped to codes instead (major currencies only).
 *
 * Throws unless at least `minRates` usable rates are found, so an error page
 * or a truncated file is never mistaken for a set of rates.
 */
export function parseGovUkRatesCsv(csvText: string, minRates: number): GovUkRates {
  const parsed = Papa.parse<string[]>(csvText.trim(), { skipEmptyLines: true })
  const [header, ...rows] = parsed.data
  if (!header) throw new Error('empty file')

  const columns = header.map(cell => cell.trim().toLowerCase())
  const rateColumn = columns.findIndex(cell => cell.includes('units per'))
  const codeColumn = columns.findIndex(cell => cell.includes('currency code'))
  const countryColumn = columns.findIndex(cell => cell.startsWith('country'))
  if (rateColumn === -1 || (codeColumn === -1 && countryColumn === -1)) {
    throw new Error('unexpected columns: ' + header.join(', '))
  }

  const rates: GovUkRates = {}
  for (const row of rows) {
    // A row cut off before its last column may hold a truncated rate. In the
    // monthly files the rate is followed by the start and end dates, so this
    // catches a download that stops mid-rate. (Every row of a real file is
    // as wide as its header.)
    if (row.length < header.length) continue
    const code = codeColumn !== -1
      ? row[codeColumn]?.trim().toUpperCase()
      : countryToCurrencyCode(row[countryColumn] ?? '')
    const rate = parseFloat(row[rateColumn]?.trim() ?? '')
    if (code && /^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0) {
      rates[code] = rate
    }
  }

  const count = Object.keys(rates).length
  if (count < minRates) throw new Error(`only ${count} rates in file`)
  return rates
}

/** Country names in yearly files before 2023 (which have no code column) */
const COUNTRY_CURRENCIES: Record<string, string> = {
  'usa': 'USD',
  'euro zone': 'EUR',
  'eurozone': 'EUR',
  'japan': 'JPY',
  'switzerland': 'CHF',
  'china': 'CNY',
  'india': 'INR',
  'brazil': 'BRL',
  'mexico': 'MXN',
  'south korea': 'KRW',
  'korea': 'KRW',
  'south africa': 'ZAR',
  'sweden': 'SEK',
  'norway': 'NOK',
  'denmark': 'DKK',
  'abu dhabi': 'AED',
  'uae': 'AED',
  'malaysia': 'MYR',
  'thailand': 'THB',
  'turkey': 'TRY',
  'poland': 'PLN',
  'hungary': 'HUF',
  'czech republic': 'CZK',
  'czechia': 'CZK',
  'israel': 'ILS',
  'kuwait': 'KWD',
  'saudi arabia': 'SAR',
  'vietnam': 'VND',
  'indonesia': 'IDR',
  'taiwan': 'TWD',
  'singapore': 'SGD',
  'hong kong': 'HKD',
  'canada': 'CAD',
  'australia': 'AUD',
  'new zealand': 'NZD',
  'russia': 'RUB',
  'philippines': 'PHP',
  'pakistan': 'PKR',
  'egypt': 'EGP',
  'nigeria': 'NGN',
  'colombia': 'COP',
  'chile': 'CLP',
  'argentina': 'ARS',
  'peru': 'PEN',
}

function countryToCurrencyCode(country: string): string {
  return COUNTRY_CURRENCIES[country.toLowerCase().trim()] ?? ''
}
