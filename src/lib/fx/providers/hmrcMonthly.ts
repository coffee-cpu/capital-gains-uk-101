import { FXSource, FXSourceAttributions } from '../../../types/fxSource'
import { BaseFXProvider, RateNotPublishedError } from './base'
import { GovUkRates, parseGovUkRatesCsv } from './govUkCsv'
import {
  BUNDLED_MONTHLY_YEARS,
  BundledYear,
  EXCLUDED_RATES,
  FIRST_BUNDLED_MONTH,
  LAST_BUNDLED_MONTH,
} from '../data/hmrcMonthly'

/** gov.uk monthly rates file (Trade Tariff service, published by HMRC) */
export function govUkMonthlyCsvUrl(year: string, month: string): string {
  return `https://www.trade-tariff.service.gov.uk/api/v2/exchange_rates/files/monthly_csv_${year}-${month}.csv`
}

/** First month HMRC publishes on gov.uk as a file */
export const FIRST_GOV_UK_MONTH = '2021-01'

/** Attribution for rates from HMRC's gov.uk files, bundled or fetched */
export const GOV_UK_ATTRIBUTION = `${FXSourceAttributions.HMRC_MONTHLY} (gov.uk)`

/** Attribution for 2015-2020 rates read from the bundled archive */
export const ARCHIVE_ATTRIBUTION = `${FXSourceAttributions.HMRC_MONTHLY} (2015-2020 archive)`

/**
 * The label every rate cached by earlier versions (read from the
 * hmrc.matchilling.com mirror) carries. Frozen here rather than taken from
 * FXSourceAttributions, so rewording the labels never invalidates caches.
 */
const MIRROR_ERA_ATTRIBUTION = 'HMRC Monthly Exchange Rates'

/**
 * A real monthly file lists 160+ currencies. Fewer than this means an error
 * page or a truncated download; a truncated month must never be kept, or
 * every currency past the cut would fail as "not published" all session.
 */
const MIN_RATES_IN_FILE = 100

type MonthRates = GovUkRates

/** Whether the app ships this month's rates (see scripts/vendor-hmrc-rates.mjs) */
export function isBundledMonth(dateKey: string): boolean {
  return dateKey >= FIRST_BUNDLED_MONTH && dateKey <= LAST_BUNDLED_MONTH
}

/**
 * HMRC Monthly Rates Provider
 *
 * Uses HMRC's official monthly exchange rates for tax purposes.
 * Each month has a single fixed rate that applies to all transactions in that month.
 *
 * The source depends on the month, never on what fails:
 * - Up to the last bundled month: rates shipped with the app, one chunk per
 *   year, loaded only when a transaction needs it. No network request, so
 *   gov.uk never learns which months someone traded in. From 2021 they are
 *   HMRC's gov.uk files; 2015 to 2020 (which gov.uk doesn't have) come from
 *   an archive. Known typos in HMRC's files are left out (EXCLUDED_RATES).
 * - Later months: the monthly CSV HMRC publishes on gov.uk (Trade Tariff
 *   service): https://www.trade-tariff.service.gov.uk/exchange_rates/monthly
 * If a month can't be supplied, the rate fails with a clear error.
 */
export class HMRCMonthlyProvider extends BaseFXProvider {
  readonly fxSource: FXSource = 'HMRC_MONTHLY'

  // Each month's file contains ALL currencies; share one in-flight fetch per
  // month so multi-currency histories don't re-download the same file
  private monthlyResponseCache = new Map<string, Promise<MonthRates>>()

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
    return dateKey < FIRST_GOV_UK_MONTH ? ARCHIVE_ATTRIBUTION : GOV_UK_ATTRIBUTION
  }

  /**
   * A bundled month is always read from the bundle, which is reviewed and
   * needs no network: a correction shipped in a later release then applies
   * at once. For later months, rates cached by earlier versions (from the
   * hmrc.matchilling.com mirror) are read again from gov.uk: the mirror has
   * differed from HMRC's files for a few minor currencies.
   */
  protected isCachedRateUsable(source: string | undefined, dateKey: string): boolean {
    return !isBundledMonth(dateKey) && source !== undefined && source !== MIRROR_ERA_ATTRIBUTION
  }

  /**
   * A cached rate never stands in for a bundled month, even if its chunk
   * fails to load: it may be a typo the bundle leaves out (e.g. BRL 439943
   * for April 2019, or KHR 3041.70 for March 2022 from gov.uk itself).
   */
  protected canFallBackToCachedRate(dateKey: string): boolean {
    return dateKey > LAST_BUNDLED_MONTH
  }

  /** One year of bundled rates: a separate chunk in the web build */
  protected async loadBundledYear(year: string): Promise<BundledYear | undefined> {
    const load = BUNDLED_MONTHLY_YEARS[year]
    return load ? (await load()).default : undefined
  }

  /**
   * Load a month's rates, deduplicating concurrent requests
   */
  private fetchMonth(year: string, month: string): Promise<MonthRates> {
    const key = `${year}-${month}`
    let promise = this.monthlyResponseCache.get(key)
    if (!promise) {
      promise = isBundledMonth(key) ? this.loadBundledMonth(key) : fetchGovUkMonth(year, month)
      this.monthlyResponseCache.set(key, promise)
      // Evict failures so transient errors can be retried
      promise.catch(() => {
        this.monthlyResponseCache.delete(key)
      })
    }
    return promise
  }

  private async loadBundledMonth(key: string): Promise<MonthRates> {
    const rates = (await this.loadBundledYear(key.slice(0, 4)))?.months[key]
    if (!rates) throw new Error(`no bundled HMRC rates for ${key}`)
    return rates
  }

  /**
   * Fetch rate from HMRC data
   */
  protected async fetchRate(date: string, currency: string): Promise<number> {
    const [year, month] = date.split('-')

    try {
      if (`${year}-${month}` < FIRST_BUNDLED_MONTH) {
        throw new Error(`HMRC monthly rates are only available from ${FIRST_BUNDLED_MONTH.slice(0, 4)}`)
      }
      const rates = await this.fetchMonth(year, month)
      const rate = rates[currency]

      if (rate === undefined) {
        const typo = EXCLUDED_RATES.includes(`${year}-${month} ${currency}`)
        throw new RateNotPublishedError(
          `Currency ${currency} not found in HMRC rates for ${year}/${month}` +
          (typo ? `: HMRC's published rate is a known error, so it's left out. Choose another FX source for this transaction` : '')
        )
      }

      // Rates are units of currency per 1 GBP: USD 1.27 means 1 GBP = 1.27 USD
      return rate
    } catch (error) {
      const Wrapped = error instanceof RateNotPublishedError ? RateNotPublishedError : Error
      throw new Wrapped(
        `Failed to fetch HMRC FX rate for ${currency} in ${year}/${month}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error }
      )
    }
  }
}

async function fetchGovUkMonth(year: string, month: string): Promise<MonthRates> {
  const response = await fetch(govUkMonthlyCsvUrl(year, month))
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? `gov.uk has no HMRC rates file for this month yet (HTTP 404)`
        : `gov.uk returned HTTP ${response.status}`
    )
  }
  return parseGovUkMonthlyCsv(await response.text())
}

/**
 * Parse HMRC's monthly CSV ("Currency Code" and "Currency Units per £1"
 * columns, found by header). Throws unless it yields a full month of rates.
 */
export function parseGovUkMonthlyCsv(csvText: string): MonthRates {
  return parseGovUkRatesCsv(csvText, MIN_RATES_IN_FILE)
}
