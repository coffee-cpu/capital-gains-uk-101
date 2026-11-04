import { FXSource } from '../../../types/fxSource'
import { getFxRateCache } from '../../cache'
import { BaseFXProvider } from './base'
import { parseGovUkRatesCsv } from './govUkCsv'

/**
 * HMRC Yearly Average Rates Provider
 *
 * Uses HMRC's annual average exchange rates.
 * These are the mean average of all monthly rates for a 12-month period.
 *
 * Official source: https://www.trade-tariff.service.gov.uk/exchange_rates/average
 *
 * Note: Average rates are published on 31st March and 31st December every year.
 * For a given calendar year, we use the rates published at the end of that year.
 */
export class HMRCYearlyProvider extends BaseFXProvider {
  readonly fxSource: FXSource = 'HMRC_YEARLY_AVG'

  // Cache of fetched yearly rates to avoid repeated API calls
  private yearlyRatesCache = new Map<string, Promise<Record<string, number>>>()

  /**
   * Generate cache key in format: HMRC_YEARLY_AVG-YYYY-CURRENCY
   */
  getCacheKey(date: string, currency: string): string {
    const year = this.getDateKey(date)
    return `${this.fxSource}-${year}-${currency}`
  }

  /**
   * Extract year from ISO date
   */
  protected getDateKey(date: string): string {
    return date.split('-')[0]
  }

  /**
   * Fetch rate from HMRC yearly average data
   */
  protected async fetchRate(date: string, currency: string): Promise<number> {
    const year = this.getDateKey(date)
    const rates = await this.getYearlyRates(year)
    const rate = rates[currency]

    if (rate === undefined || rate === null) {
      throw new Error(`Currency ${currency} not found in HMRC yearly average rates for ${year}`)
    }

    return rate
  }

  /**
   * Get all rates for a year (with caching)
   */
  private async getYearlyRates(year: string): Promise<Record<string, number>> {
    // Check in-memory cache first
    if (this.yearlyRatesCache.has(year)) {
      return this.yearlyRatesCache.get(year)!
    }

    // Start fetching and cache the promise
    const fetchPromise = this.fetchYearlyRates(year)
    this.yearlyRatesCache.set(year, fetchPromise)

    try {
      return await fetchPromise
    } catch (error) {
      // Remove failed promise from cache so it can be retried
      this.yearlyRatesCache.delete(year)
      throw error
    }
  }

  /**
   * Fetch yearly average rates from HMRC
   * Uses the CSV endpoint from trade-tariff.service.gov.uk
   *
   * HMRC publishes average rates semi-annually:
   * - December file: Calendar year average (Jan 1 - Dec 31), published Dec 31
   * - March file: Tax year period average (Apr 1 - Mar 31), published Mar 31
   *
   * Fallback order:
   * 1. December file (calendar year) - preferred for full year data
   * 2. March file (tax year period) - useful for Jan-Mar transactions when Dec not yet available
   * 3. Monthly rates - calculate average from available monthly data
   *
   * Note: CSV format changed in 2023 - older files lack the Currency Code column.
   * The parser handles both formats by detecting the header.
   *
   * URL format: /api/v2/exchange_rates/files/average_csv_YYYY-M.csv (the
   * /exchange_rates/view/files/ path returns 403 to non-browser clients)
   */
  private async fetchYearlyRates(year: string): Promise<Record<string, number>> {
    // Try December file first (calendar year average: Jan 1 - Dec 31)
    const decUrl = `https://www.trade-tariff.service.gov.uk/api/v2/exchange_rates/files/average_csv_${year}-12.csv`

    try {
      const response = await fetch(decUrl)
      if (response.ok) {
        const csvText = await response.text()
        const rates = this.parseYearlyRatesCSV(csvText)

        await this.cacheYearlyRates(year, rates)
        return rates
      }
    } catch (error) {
      console.warn(`December average rates not available for ${year}:`, error)
    }

    // Try March file (tax year period: Apr 1 prev year - Mar 31 this year)
    // Useful for Jan-Mar transactions when December file not yet published
    const marUrl = `https://www.trade-tariff.service.gov.uk/api/v2/exchange_rates/files/average_csv_${year}-3.csv`

    try {
      const response = await fetch(marUrl)
      if (response.ok) {
        const csvText = await response.text()
        const rates = this.parseYearlyRatesCSV(csvText)

        await this.cacheYearlyRates(year, rates)
        return rates
      }
    } catch (error) {
      console.warn(`March average rates not available for ${year}:`, error)
    }

    // No fallback - if yearly data isn't available, throw a clear error
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // 1-12
    const currentDay = now.getDate()
    const yearNum = parseInt(year)

    // Check if March file should be available (published on March 31)
    const marchFileAvailable = currentMonth > 3 || (currentMonth === 3 && currentDay >= 31)

    // Future year
    if (yearNum > currentYear) {
      throw new Error(
        `HMRC Yearly Average rates for ${year} are not yet available. ` +
        `Yearly averages are published on March 31 and December 31. ` +
        `Please use "HMRC Monthly Rates" or "Daily Spot Rates" for future year transactions.`
      )
    }

    // Current year - check if March file should be available
    if (yearNum === currentYear) {
      if (!marchFileAvailable) {
        throw new Error(
          `HMRC Yearly Average rates for ${year} are not yet available. ` +
          `The March ${year} file will be published on March 31. ` +
          `Please use "HMRC Monthly Rates" or "Daily Spot Rates" for current year transactions.`
        )
      }
      // After March 31, the March file should exist but both files failed
      throw new Error(
        `HMRC Yearly Average rates for ${year} could not be loaded. ` +
        `The March ${year} file should be available but the request failed. ` +
        `Please try again or use a different FX source.`
      )
    }

    // Years before 2020
    if (yearNum < 2020) {
      throw new Error(
        `HMRC Yearly Average rates are not available for years before 2020. ` +
        `Please use "HMRC Monthly Rates" or "Daily Spot Rates" for transactions in ${year}.`
      )
    }

    // General error for years 2020-2025 (or older current years)
    throw new Error(
      `HMRC Yearly Average rates for ${year} could not be loaded. ` +
      `Please try again or use a different FX source.`
    )
  }

  /**
   * Parse the HMRC yearly average rates CSV. Two formats exist: 2023+ has a
   * Currency Code column, 2022 and earlier only country names (see
   * parseGovUkRatesCsv).
   */
  private parseYearlyRatesCSV(csvText: string): Record<string, number> {
    return parseGovUkRatesCsv(csvText, 1)
  }

  /**
   * Cache yearly rates
   */
  private async cacheYearlyRates(year: string, rates: Record<string, number>): Promise<void> {
    const entries = Object.entries(rates).map(([currency, rate]) => ({
      id: this.getCacheKey(`${year}-01-01`, currency),
      date: year,
      currency,
      rate,
      source: 'HMRC Annual Average Rates',
      fxSource: this.fxSource,
    }))

    await getFxRateCache().bulkPut(entries)
  }
}
