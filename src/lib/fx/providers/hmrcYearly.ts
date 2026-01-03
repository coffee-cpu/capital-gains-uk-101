import { FXStrategy } from '../../../types/fxStrategy'
import { db } from '../../db'
import { BaseFXProvider } from './base'

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
  readonly strategy: FXStrategy = 'HMRC_YEARLY_AVG'

  // Cache of fetched yearly rates to avoid repeated API calls
  private yearlyRatesCache = new Map<string, Promise<Record<string, number>>>()

  /**
   * Generate cache key in format: HMRC_YEARLY_AVG-YYYY-CURRENCY
   */
  getCacheKey(date: string, currency: string): string {
    const year = this.getDateKey(date)
    return `${this.strategy}-${year}-${currency}`
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
    if (currency === 'GBP') {
      return 1
    }

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
   */
  private async fetchYearlyRates(year: string): Promise<Record<string, number>> {
    // The average rates CSV includes data for multiple years
    // We need to parse it and find the rates for the requested year
    const url = 'https://www.trade-tariff.service.gov.uk/exchange_rates/average.csv'

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HMRC yearly rates API error: ${response.status}`)
      }

      const csvText = await response.text()
      const rates = this.parseYearlyRatesCSV(csvText, year)

      // Cache all rates for this year in IndexedDB
      await this.cacheYearlyRates(year, rates)

      return rates
    } catch (error) {
      console.error(`Failed to fetch HMRC yearly rates for ${year}:`, error)

      // Fall back to calculating from monthly rates if available
      try {
        return await this.calculateFromMonthlyRates(year)
      } catch {
        throw new Error(
          `Failed to fetch HMRC yearly average rates for ${year}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }
  }

  /**
   * Parse the HMRC yearly average rates CSV
   * Format: currency_code,currency_description,rate,validity_start_date,validity_end_date
   */
  private parseYearlyRatesCSV(csvText: string, year: string): Record<string, number> {
    const lines = csvText.split('\n')
    const rates: Record<string, number> = {}

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Parse CSV - handle quoted values
      const parts = this.parseCSVLine(line)
      if (parts.length < 5) continue

      const [currencyCode, , rateStr, startDate, endDate] = parts

      // Check if this rate is for the requested year
      // Average rates typically have validity_end_date in the format YYYY-MM-DD
      const rateYear = endDate?.split('-')[0] || startDate?.split('-')[0]

      if (rateYear === year) {
        const rate = parseFloat(rateStr)
        if (!isNaN(rate) && rate > 0) {
          rates[currencyCode] = rate
        }
      }
    }

    if (Object.keys(rates).length === 0) {
      throw new Error(`No rates found for year ${year} in HMRC average rates`)
    }

    return rates
  }

  /**
   * Simple CSV line parser that handles quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }

    result.push(current.trim())
    return result
  }

  /**
   * Calculate yearly average from monthly rates if direct yearly data unavailable
   */
  private async calculateFromMonthlyRates(year: string): Promise<Record<string, number>> {
    // Try to get cached monthly rates and calculate average
    const monthlyRates = await db.fx_rates
      .where('date')
      .startsWith(`${year}-`)
      .and((rate) => rate.strategy === 'HMRC_MONTHLY' || !rate.strategy)
      .toArray()

    if (monthlyRates.length === 0) {
      throw new Error(`No monthly rates available to calculate yearly average for ${year}`)
    }

    // Group by currency and calculate average
    const currencyRates: Record<string, number[]> = {}

    for (const rate of monthlyRates) {
      if (!currencyRates[rate.currency]) {
        currencyRates[rate.currency] = []
      }
      currencyRates[rate.currency].push(rate.rate)
    }

    const averageRates: Record<string, number> = {}
    for (const [currency, rates] of Object.entries(currencyRates)) {
      const sum = rates.reduce((a, b) => a + b, 0)
      averageRates[currency] = sum / rates.length
    }

    return averageRates
  }

  /**
   * Cache yearly rates in IndexedDB
   */
  private async cacheYearlyRates(year: string, rates: Record<string, number>): Promise<void> {
    const entries = Object.entries(rates).map(([currency, rate]) => ({
      id: this.getCacheKey(`${year}-01-01`, currency),
      date: year,
      currency,
      rate,
      source: 'HMRC Annual Average Rates',
      strategy: this.strategy as FXStrategy,
    }))

    await db.fx_rates.bulkPut(entries)
  }
}
