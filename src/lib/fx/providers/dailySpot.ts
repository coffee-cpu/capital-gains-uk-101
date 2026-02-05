import { FXSource } from '../../../types/fxSource'
import { db } from '../../db'
import { BaseFXProvider } from './base'

/**
 * Daily Spot Rates Provider
 *
 * Uses European Central Bank (ECB) daily spot rates via the Frankfurter API.
 * Provides the most accurate conversion for transaction-date calculations.
 *
 * API: https://api.frankfurter.dev/v1/YYYY-MM-DD
 * Time series: https://api.frankfurter.dev/v1/2020-01-01..2020-12-31
 *
 * Features:
 * - Free, no API key required
 * - No rate limits
 * - Data available since 1999
 * - Supports batch prefetching for efficiency
 *
 * @see https://frankfurter.dev/
 */
export class DailySpotProvider extends BaseFXProvider {
  readonly fxSource: FXSource = 'DAILY_SPOT'

  // Track pending prefetch operations to avoid duplicates
  private pendingPrefetches = new Map<string, Promise<void>>()

  /**
   * Generate cache key in format: DAILY_SPOT-YYYY-MM-DD-CURRENCY
   */
  getCacheKey(date: string, currency: string): string {
    return `${this.fxSource}-${date}-${currency}`
  }

  /**
   * For daily rates, the date key is the full date
   */
  protected getDateKey(date: string): string {
    return date
  }

  /**
   * Fetch rate from Frankfurter API for a single date
   */
  protected async fetchRate(date: string, currency: string): Promise<number> {
    // Frankfurter uses GBP as base, returns rates for other currencies
    const url = `https://api.frankfurter.dev/v1/${date}?from=GBP&to=${currency}`

    try {
      const response = await fetch(url)
      if (!response.ok) {
        // If the date is a weekend/holiday, ECB has no data - try previous business day
        if (response.status === 404) {
          return this.fetchPreviousBusinessDay(date, currency)
        }
        throw new Error(`Frankfurter API error: ${response.status}`)
      }

      const data: FrankfurterResponse = await response.json()
      const rate = data.rates[currency]

      if (rate === undefined || rate === null) {
        throw new Error(`Currency ${currency} not found in Frankfurter response for ${date}`)
      }

      if (isNaN(rate) || rate <= 0) {
        throw new Error(`Invalid rate from Frankfurter API: ${rate}`)
      }

      return rate
    } catch (error) {
      throw new Error(
        `Failed to fetch daily spot rate for ${currency} on ${date}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * When a date falls on weekend/holiday, find the most recent business day
   */
  private async fetchPreviousBusinessDay(date: string, currency: string): Promise<number> {
    const targetDate = new Date(date)
    let attempts = 0
    const maxAttempts = 7 // Look back up to a week

    while (attempts < maxAttempts) {
      targetDate.setDate(targetDate.getDate() - 1)
      attempts++

      const prevDate = targetDate.toISOString().split('T')[0]
      const url = `https://api.frankfurter.dev/v1/${prevDate}?from=GBP&to=${currency}`

      try {
        const response = await fetch(url)
        if (response.ok) {
          const data: FrankfurterResponse = await response.json()
          const rate = data.rates[currency]
          if (rate !== undefined && rate !== null && !isNaN(rate) && rate > 0) {
            // Cache this rate for the original date too (weekend uses Friday's rate)
            return rate
          }
        }
      } catch {
        // Continue to next day
      }
    }

    throw new Error(`Could not find valid rate for ${currency} near ${date}`)
  }

  /**
   * Prefetch rates for a date range - uses Frankfurter time series API
   * This is much more efficient than fetching individual dates
   */
  async prefetchRates(startDate: string, endDate: string, currencies: string[]): Promise<void> {
    // Filter out GBP - no need to fetch
    const nonGbpCurrencies = currencies.filter((c) => c !== 'GBP')
    if (nonGbpCurrencies.length === 0) return

    const prefetchKey = `${startDate}-${endDate}-${nonGbpCurrencies.sort().join(',')}`

    // Avoid duplicate requests
    if (this.pendingPrefetches.has(prefetchKey)) {
      return this.pendingPrefetches.get(prefetchKey)
    }

    const prefetchPromise = this.doPrefetch(startDate, endDate, nonGbpCurrencies)
    this.pendingPrefetches.set(prefetchKey, prefetchPromise)

    try {
      await prefetchPromise
    } finally {
      this.pendingPrefetches.delete(prefetchKey)
    }
  }

  private async doPrefetch(
    startDate: string,
    endDate: string,
    currencies: string[]
  ): Promise<void> {
    // First check what's already cached to avoid redundant API calls
    const uncachedDates = await this.findUncachedDates(startDate, endDate, currencies)

    if (uncachedDates.length === 0) {
      return // All already cached
    }

    // Frankfurter supports time series requests
    // Max reasonable date range is 1 year to avoid timeout
    const batches = this.splitIntoYearBatches(uncachedDates)

    for (const batch of batches) {
      const url = `https://api.frankfurter.dev/v1/${batch.start}..${batch.end}?from=GBP&to=${currencies.join(',')}`

      try {
        const response = await fetch(url)
        if (!response.ok) {
          console.warn(`Prefetch failed for ${batch.start}..${batch.end}: ${response.status}`)
          continue
        }

        const data: FrankfurterTimeSeriesResponse = await response.json()

        // Cache all rates from the response
        await this.cacheTimeSeriesRates(data.rates, currencies)
      } catch (error) {
        console.warn(`Prefetch error for ${batch.start}..${batch.end}:`, error)
        // Continue with next batch - individual fetches will handle failures
      }
    }
  }

  /**
   * Find dates that aren't already cached
   */
  private async findUncachedDates(
    startDate: string,
    endDate: string,
    currencies: string[]
  ): Promise<string[]> {
    const dates: string[] = []
    const current = new Date(startDate)
    const end = new Date(endDate)

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0]

      // Check if ANY currency is uncached for this date
      for (const currency of currencies) {
        const cacheKey = this.getCacheKey(dateStr, currency)
        const cached = await db.fx_rates.get(cacheKey)
        if (!cached) {
          dates.push(dateStr)
          break // Only need to add the date once
        }
      }

      current.setDate(current.getDate() + 1)
    }

    return dates
  }

  /**
   * Split dates into batches of max 1 year each
   */
  private splitIntoYearBatches(dates: string[]): Array<{ start: string; end: string }> {
    if (dates.length === 0) return []

    const sorted = [...dates].sort()
    const batches: Array<{ start: string; end: string }> = []

    let batchStart = sorted[0]
    let batchEnd = sorted[0]

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i]
      const startDate = new Date(batchStart)
      const currentDate = new Date(current)

      // Check if we've exceeded 365 days
      const daysDiff = Math.floor(
        (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysDiff > 365) {
        // Save current batch and start new one
        batches.push({ start: batchStart, end: batchEnd })
        batchStart = current
      }

      batchEnd = current
    }

    // Add the last batch
    batches.push({ start: batchStart, end: batchEnd })

    return batches
  }

  /**
   * Cache rates from a time series response
   */
  private async cacheTimeSeriesRates(
    rates: Record<string, Record<string, number>>,
    currencies: string[]
  ): Promise<void> {
    const entries: Array<{
      id: string
      date: string
      currency: string
      rate: number
      source: string
      fxSource: FXSource
    }> = []

    for (const [date, currencyRates] of Object.entries(rates)) {
      for (const currency of currencies) {
        const rate = currencyRates[currency]
        if (rate !== undefined && rate !== null && !isNaN(rate) && rate > 0) {
          entries.push({
            id: this.getCacheKey(date, currency),
            date,
            currency,
            rate,
            source: 'European Central Bank (via Frankfurter)',
            fxSource: this.fxSource,
          })
        }
      }
    }

    // Bulk insert for efficiency
    if (entries.length > 0) {
      await db.fx_rates.bulkPut(entries)
    }
  }
}

/**
 * Frankfurter API single date response
 */
interface FrankfurterResponse {
  amount: number
  base: string
  date: string
  rates: Record<string, number>
}

/**
 * Frankfurter API time series response
 */
interface FrankfurterTimeSeriesResponse {
  amount: number
  base: string
  start_date: string
  end_date: string
  rates: Record<string, Record<string, number>>
}
