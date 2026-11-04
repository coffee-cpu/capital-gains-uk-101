import { FXSource, FXSourceAttributions } from '../../../types/fxSource'
import { BaseFXProvider, RateNotPublishedError } from './base'
import { GovUkRates, parseGovUkRatesCsv } from './govUkCsv'

/** gov.uk monthly rates file (Trade Tariff service, published by HMRC) */
export function govUkMonthlyCsvUrl(year: string, month: string): string {
  return `https://www.trade-tariff.service.gov.uk/api/v2/exchange_rates/files/monthly_csv_${year}-${month}.csv`
}

/** First month HMRC publishes on gov.uk as a file */
export const FIRST_GOV_UK_MONTH = '2021-01'

/** First month in the bundled archive of older rates */
export const FIRST_ARCHIVE_MONTH = '2015-01'

/** Attribution for rates read from gov.uk */
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

interface MonthlyArchive {
  months: Record<string, MonthRates>
}

/**
 * HMRC Monthly Rates Provider
 *
 * Uses HMRC's official monthly exchange rates for tax purposes.
 * Each month has a single fixed rate that applies to all transactions in that month.
 *
 * The source depends on the month, never on what fails:
 * - January 2021 onwards: the monthly CSV HMRC publishes on gov.uk (Trade
 *   Tariff service): https://www.trade-tariff.service.gov.uk/exchange_rates/monthly
 *   If gov.uk can't supply a month, the rate fails with a clear error.
 * - 2015 to 2020: gov.uk has no files for these months, so they come from an
 *   archive bundled with the app (see scripts/vendor-hmrc-monthly-archive.mjs).
 *   It's loaded only when a transaction needs it.
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
   * Rates cached by earlier versions came from the hmrc.matchilling.com
   * mirror. Read them again from gov.uk or the archive: the mirror has
   * differed from HMRC's current files for a few minor currencies, and kept
   * typos the archive leaves out.
   */
  protected isCachedRateUsable(source: string | undefined): boolean {
    return source !== undefined && source !== MIRROR_ERA_ATTRIBUTION
  }

  /**
   * Before 2021 a mirror-era cached rate may be one of the typos the archive
   * deliberately leaves out (e.g. BRL 439943 for April 2019), so it must
   * never stand in, even if loading the archive fails. From 2021 the mirror
   * matched gov.uk for every major currency, so it beats no rate offline.
   */
  protected canFallBackToCachedRate(dateKey: string): boolean {
    return dateKey >= FIRST_GOV_UK_MONTH
  }

  /** The bundled 2015-2020 archive: a separate chunk in the web build */
  protected async loadArchive(): Promise<MonthlyArchive> {
    return (await import('../data/hmrcMonthlyArchive.json')).default
  }

  /**
   * Load a month's rates, deduplicating concurrent requests
   */
  private fetchMonth(year: string, month: string): Promise<MonthRates> {
    const key = `${year}-${month}`
    let promise = this.monthlyResponseCache.get(key)
    if (!promise) {
      promise = key < FIRST_GOV_UK_MONTH ? this.loadArchiveMonth(key) : fetchGovUkMonth(year, month)
      this.monthlyResponseCache.set(key, promise)
      // Evict failures so transient errors can be retried
      promise.catch(() => {
        this.monthlyResponseCache.delete(key)
      })
    }
    return promise
  }

  private async loadArchiveMonth(key: string): Promise<MonthRates> {
    if (key < FIRST_ARCHIVE_MONTH) {
      throw new Error(`HMRC monthly rates are only available from ${FIRST_ARCHIVE_MONTH.slice(0, 4)}`)
    }
    const rates = (await this.loadArchive()).months[key]
    if (!rates) throw new Error(`no archived HMRC rates for ${key}`)
    return rates
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
        throw new RateNotPublishedError(`Currency ${currency} not found in HMRC rates for ${year}/${month}`)
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
