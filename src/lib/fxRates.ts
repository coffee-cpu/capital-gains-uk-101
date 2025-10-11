import { db } from './db'

/**
 * HMRC Exchange Rates API
 *
 * HMRC publishes official exchange rates on a monthly basis for tax purposes.
 * Each month has a single fixed rate for every foreign currency against GBP.
 * These are the official rates required for UK tax reporting.
 *
 * API docs: https://github.com/matchilling/hmrc-exchange-rates
 * API endpoint: https://hmrc.matchilling.com/rate/YYYY/MM.json
 */

interface HMRCRateResponse {
  base: string
  period: {
    start: string
    end: string
  }
  rates: Record<string, string>
}

/**
 * Fetch FX rate for a given date and currency using HMRC official rates
 *
 * @param date ISO date string (YYYY-MM-DD)
 * @param currency Currency code (e.g., 'USD')
 * @returns FX rate (units of currency per 1 GBP)
 */
export async function getFXRate(date: string, currency: string): Promise<number> {
  // GBP to GBP is always 1
  if (currency === 'GBP') {
    return 1
  }

  // Extract year and month from date
  const [year, month] = date.split('-')
  const monthKey = `${year}-${month}`

  // Check cache first - use month-based key since HMRC rates are monthly
  const cacheKey = `${monthKey}-${currency}`
  const cached = await db.fx_rates.get(cacheKey)

  if (cached) {
    return cached.rate
  }

  // Fetch from HMRC API
  const rate = await fetchFromHMRC(year, month, currency)

  // Cache the result with the month key
  await db.fx_rates.put({
    id: cacheKey,
    date: monthKey,
    currency,
    rate,
    source: 'HMRC',
  })

  return rate
}

/**
 * Fetch exchange rate from HMRC official rates API
 *
 * HMRC provides monthly exchange rates for tax purposes.
 * Each month has a single rate that applies to all transactions in that month.
 *
 * API docs: https://github.com/matchilling/hmrc-exchange-rates
 */
async function fetchFromHMRC(year: string, month: string, currency: string): Promise<number> {
  if (currency === 'GBP') {
    return 1
  }

  // HMRC API format: https://hmrc.matchilling.com/rate/YYYY/MM.json
  const url = `https://hmrc.matchilling.com/rate/${year}/${month}.json`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HMRC API error: ${response.status}`)
    }

    const data: HMRCRateResponse = await response.json()

    const rateStr = data.rates[currency]

    if (!rateStr) {
      throw new Error(`Currency ${currency} not found in HMRC rates for ${year}/${month}`)
    }

    const rate = parseFloat(rateStr)

    if (isNaN(rate) || rate <= 0) {
      throw new Error(`Invalid rate from HMRC API: ${rateStr}`)
    }

    // The API returns how many units of currency per 1 GBP
    // For example, if USD rate is 1.27, it means 1 GBP = 1.27 USD
    // To convert USD to GBP, we divide: GBP = USD / 1.27
    return rate
  } catch (error) {
    console.error(`Failed to fetch HMRC FX rate for ${currency} in ${year}/${month}:`, error)
    throw new Error(`Failed to fetch HMRC FX rate for ${currency} in ${year}/${month}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Convert amount from foreign currency to GBP
 *
 * @param amount Amount in foreign currency
 * @param fxRate FX rate (units of currency per 1 GBP)
 * @returns Amount in GBP
 */
export function convertToGBP(amount: number, fxRate: number): number {
  if (fxRate === 1) return amount
  return amount / fxRate
}
