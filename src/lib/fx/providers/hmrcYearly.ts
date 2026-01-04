import { FXSource } from '../../../types/fxSource'
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
   * URL format: /exchange_rates/view/files/average_csv_YYYY-M.csv
   */
  private async fetchYearlyRates(year: string): Promise<Record<string, number>> {
    // Try December file first (calendar year average: Jan 1 - Dec 31)
    const decUrl = `https://www.trade-tariff.service.gov.uk/exchange_rates/view/files/average_csv_${year}-12.csv`

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
    const marUrl = `https://www.trade-tariff.service.gov.uk/exchange_rates/view/files/average_csv_${year}-3.csv`

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
    const currentYear = new Date().getFullYear()
    const yearNum = parseInt(year)

    if (yearNum >= currentYear) {
      throw new Error(
        `HMRC Yearly Average rates for ${year} are not yet available. ` +
        `Yearly averages are published on Dec 31. ` +
        `Please use "HMRC Monthly Rates" or "Daily Spot Rates" for current year transactions.`
      )
    }
    if (yearNum < 2020) {
      throw new Error(
        `HMRC Yearly Average rates are not available for years before 2020. ` +
        `Please use "HMRC Monthly Rates" or "Daily Spot Rates" for transactions in ${year}.`
      )
    }
    throw new Error(
      `HMRC Yearly Average rates for ${year} could not be loaded. ` +
      `Please try again or use a different FX source.`
    )
  }

  /**
   * Parse the HMRC yearly average rates CSV
   *
   * Two formats exist:
   * - 2023+: Country, Currency, Currency Code, Sterling value, Units per £1 (5 columns)
   * - 2022-: Country, Currency, Sterling value, Units per pound (4 columns, no code)
   *
   * We detect the format by checking if header contains "Currency Code"
   */
  private parseYearlyRatesCSV(csvText: string): Record<string, number> {
    const lines = csvText.split('\n')
    const rates: Record<string, number> = {}

    if (lines.length === 0) {
      throw new Error('Empty CSV file')
    }

    // Detect format from header
    const header = lines[0].toLowerCase()
    const hasCurrencyCodeColumn = header.includes('currency code')

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Parse CSV - handle quoted values
      const parts = this.parseCSVLine(line)

      let currencyCode: string
      let rateStr: string

      if (hasCurrencyCodeColumn) {
        // New format (2023+): Country, Currency, Code, Sterling value, Units per £1
        if (parts.length < 5) continue
        currencyCode = parts[2]?.trim()
        rateStr = parts[4]?.trim()
      } else {
        // Old format (2022-): Country, Currency, Sterling value, Units per pound
        if (parts.length < 4) continue
        const country = parts[0]?.trim()
        currencyCode = this.countryToCurrencyCode(country)
        rateStr = parts[3]?.trim()
      }

      if (!currencyCode || !rateStr) continue

      const rate = parseFloat(rateStr)
      if (!isNaN(rate) && rate > 0) {
        rates[currencyCode] = rate
      }
    }

    if (Object.keys(rates).length === 0) {
      throw new Error('No rates found in HMRC average rates CSV')
    }

    return rates
  }

  /**
   * Map country name to ISO 4217 currency code (for pre-2023 CSV format)
   */
  private countryToCurrencyCode(country: string): string {
    const name = country?.toLowerCase().trim() || ''

    // Map country names to their primary currency codes
    const mappings: Record<string, string> = {
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

    return mappings[name] || ''
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
   * Cache yearly rates in IndexedDB
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

    await db.fx_rates.bulkPut(entries)
  }
}
