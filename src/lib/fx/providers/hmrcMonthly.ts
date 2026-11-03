import Papa from 'papaparse'
import { FXSource, FXSourceAttributions } from '../../../types/fxSource'
import { BaseFXProvider } from './base'

/** gov.uk monthly rates file (Trade Tariff service, published by HMRC) */
export function govUkMonthlyCsvUrl(year: string, month: string): string {
  return `https://www.trade-tariff.service.gov.uk/api/v2/exchange_rates/files/monthly_csv_${year}-${month}.csv`
}

/** Community JSON mirror of the same HMRC data, used only as a fallback */
export function mirrorMonthlyJsonUrl(year: string, month: string): string {
  return `https://hmrc.matchilling.com/rate/${year}/${month}.json`
}

/** Attribution for rates read from gov.uk */
export const GOV_UK_ATTRIBUTION = `${FXSourceAttributions.HMRC_MONTHLY} (gov.uk)`

/** Attribution for months the gov.uk file couldn't supply */
export const MIRROR_ATTRIBUTION = `${FXSourceAttributions.HMRC_MONTHLY} (via hmrc.matchilling.com mirror)`

/**
 * A real monthly file lists well over 100 currencies. Fewer than this means
 * an error page or a truncated file, so the month falls back to the mirror.
 */
const MIN_RATES_IN_FILE = 20

type MonthRates = Record<string, number>

/**
 * HMRC Monthly Rates Provider
 *
 * Uses HMRC's official monthly exchange rates for tax purposes.
 * Each month has a single fixed rate that applies to all transactions in that month.
 *
 * Source: the monthly CSV HMRC publishes on gov.uk (Trade Tariff service):
 * https://www.trade-tariff.service.gov.uk/exchange_rates/monthly
 *
 * Fallback: if gov.uk can't supply a month (not published as a file for that
 * month, unreachable, blocked, or malformed), the month is read from the
 * hmrc.matchilling.com JSON mirror of the same data. Rates from the mirror
 * carry MIRROR_ATTRIBUTION, so reports show where they came from.
 */
export class HMRCMonthlyProvider extends BaseFXProvider {
  readonly fxSource: FXSource = 'HMRC_MONTHLY'

  // Each month's file contains ALL currencies; share one in-flight fetch per
  // month so multi-currency histories don't re-download the same file
  private monthlyResponseCache = new Map<string, Promise<MonthRates>>()

  /** Months (YYYY-MM) whose rates came from the mirror */
  private mirrorMonths = new Set<string>()

  /**
   * Set after a network-level failure (e.g. the browser blocks the request
   * under CORS): gov.uk is then skipped for the rest of this provider's life
   * instead of failing once per month. HTTP errors (404) stay per month.
   */
  private govUkUnreachable = false

  /**
   * Generate cache key in format: HMRC_MONTHLY-YYYY-MM-CURRENCY
   */
  getCacheKey(date: string, currency: string): string {
    const dateKey = this.getDateKey(date)
    return `${this.fxSource}-${dateKey}-${currency}`
  }

  /**
   * Extract year-month from ISO date
   */
  protected getDateKey(date: string): string {
    const [year, month] = date.split('-')
    return `${year}-${month}`
  }

  protected sourceAttribution(dateKey: string): string {
    return this.mirrorMonths.has(dateKey) ? MIRROR_ATTRIBUTION : GOV_UK_ATTRIBUTION
  }

  /**
   * Rates cached before gov.uk became the source carry the plain label but
   * came from the mirror; refetch them so gov.uk is tried and the label is
   * accurate.
   */
  protected isCachedRateUsable(source: string | undefined): boolean {
    return source === GOV_UK_ATTRIBUTION || source === MIRROR_ATTRIBUTION
  }

  /**
   * Fetch a month's rates (gov.uk first, then the mirror), deduplicating
   * concurrent requests
   */
  private fetchMonth(year: string, month: string): Promise<MonthRates> {
    const key = `${year}-${month}`
    let promise = this.monthlyResponseCache.get(key)
    if (!promise) {
      promise = (async () => {
        if (!this.govUkUnreachable) {
          try {
            return await fetchGovUkMonth(year, month)
          } catch (govUkError) {
            // fetch() rejects (TypeError) only when the request couldn't be
            // made at all, e.g. blocked or offline, not for HTTP errors
            if (govUkError instanceof TypeError) this.govUkUnreachable = true
            console.warn(`gov.uk HMRC rates for ${key} unavailable, using the mirror:`, govUkError)
          }
        }
        const rates = await fetchMirrorMonth(year, month)
        this.mirrorMonths.add(key)
        return rates
      })()
      this.monthlyResponseCache.set(key, promise)
      // Evict failures so transient errors can be retried
      promise.catch(() => {
        this.monthlyResponseCache.delete(key)
      })
    }
    return promise
  }

  /**
   * Fetch rate from HMRC data
   */
  protected async fetchRate(date: string, currency: string): Promise<number> {
    const [year, month] = date.split('-')

    try {
      const rates = await this.fetchMonth(year, month)
      const rate = rates[currency]

      if (rate === undefined) {
        throw new Error(`Currency ${currency} not found in HMRC rates for ${year}/${month}`)
      }

      // Rates are units of currency per 1 GBP: USD 1.27 means 1 GBP = 1.27 USD
      return rate
    } catch (error) {
      throw new Error(
        `Failed to fetch HMRC FX rate for ${currency} in ${year}/${month}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error }
      )
    }
  }
}

async function fetchGovUkMonth(year: string, month: string): Promise<MonthRates> {
  const response = await fetch(govUkMonthlyCsvUrl(year, month))
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return parseGovUkMonthlyCsv(await response.text())
}

/**
 * Parse HMRC's monthly CSV: one row per country with "Currency Code" and
 * "Currency Units per £1" columns (found by header, so column order changes
 * don't break it). Throws unless it yields a credible set of rates.
 */
export function parseGovUkMonthlyCsv(csvText: string): MonthRates {
  const parsed = Papa.parse<string[]>(csvText.trim(), { skipEmptyLines: true })
  const [header, ...rows] = parsed.data
  if (!header) throw new Error('empty file')

  const columns = header.map(cell => cell.trim().toLowerCase())
  const codeColumn = columns.findIndex(cell => cell.includes('currency code'))
  const rateColumn = columns.findIndex(cell => cell.includes('units per'))
  if (codeColumn === -1 || rateColumn === -1) {
    throw new Error('unexpected columns: ' + header.join(', '))
  }

  const rates: MonthRates = {}
  for (const row of rows) {
    const code = row[codeColumn]?.trim().toUpperCase()
    const rate = parseFloat(row[rateColumn]?.trim() ?? '')
    if (code && /^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0) {
      rates[code] = rate
    }
  }

  if (Object.keys(rates).length < MIN_RATES_IN_FILE) {
    throw new Error(`only ${Object.keys(rates).length} rates in file`)
  }
  return rates
}

async function fetchMirrorMonth(year: string, month: string): Promise<MonthRates> {
  const response = await fetch(mirrorMonthlyJsonUrl(year, month))
  if (!response.ok) {
    throw new Error(`HMRC API error: ${response.status}`)
  }
  const data = (await response.json()) as MirrorResponse
  const rates: MonthRates = {}
  for (const [code, value] of Object.entries(data.rates ?? {})) {
    const rate = parseFloat(value)
    // Skip bad entries: one unusable currency mustn't fail the whole month.
    // fetchRate reports a missing currency for the one asked for.
    if (Number.isFinite(rate) && rate > 0) rates[code] = rate
  }
  return rates
}

/**
 * Mirror response format
 */
interface MirrorResponse {
  base: string
  period: {
    start: string
    end: string
  }
  rates: Record<string, string>
}
