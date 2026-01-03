import { FXProvider, FXRateResult, FXSource, FXSourceAttributions } from '../../../types/fxSource'
import { db } from '../../db'

/**
 * Abstract base class for FX providers
 *
 * Provides common functionality for caching and result creation.
 * Each provider implements source-specific rate fetching.
 */
export abstract class BaseFXProvider implements FXProvider {
  abstract readonly fxSource: FXSource

  /**
   * Get the exchange rate for a specific date and currency
   * Checks cache first, then fetches from API if needed
   */
  async getRate(date: string, currency: string): Promise<FXRateResult> {
    // GBP to GBP is always 1
    if (currency === 'GBP') {
      return this.createResult(1, date, currency)
    }

    const cacheKey = this.getCacheKey(date, currency)

    // Check IndexedDB cache first
    const cached = await db.fx_rates.get(cacheKey)
    if (cached) {
      return this.createResult(cached.rate, date, currency)
    }

    // Fetch from API
    const rate = await this.fetchRate(date, currency)

    // Cache the result
    await this.cacheRate(cacheKey, date, currency, rate)

    return this.createResult(rate, date, currency)
  }

  /**
   * Generate cache key for a given date and currency
   * Format: {SOURCE}-{dateKey}-{currency}
   */
  abstract getCacheKey(date: string, currency: string): string

  /**
   * Extract the date key portion for the cache key
   * HMRC_MONTHLY uses YYYY-MM, DAILY_SPOT uses YYYY-MM-DD, etc.
   */
  protected abstract getDateKey(date: string): string

  /**
   * Fetch the exchange rate from the external API
   * Must be implemented by each provider
   */
  protected abstract fetchRate(date: string, currency: string): Promise<number>

  /**
   * Create a standardized FX rate result
   */
  protected createResult(rate: number, date: string, currency: string): FXRateResult {
    return {
      rate,
      dateKey: this.getDateKey(date),
      currency,
      fxSource: this.fxSource,
      source: FXSourceAttributions[this.fxSource],
    }
  }

  /**
   * Cache the rate in IndexedDB
   */
  protected async cacheRate(
    cacheKey: string,
    date: string,
    currency: string,
    rate: number
  ): Promise<void> {
    await db.fx_rates.put({
      id: cacheKey,
      date: this.getDateKey(date),
      currency,
      rate,
      source: FXSourceAttributions[this.fxSource],
      fxSource: this.fxSource,
    })
  }

  /**
   * Optional prefetch for batch efficiency
   * Default implementation does nothing - override in providers that support batching
   */
  async prefetchRates?(
    _startDate: string,
    _endDate: string,
    _currencies: string[]
  ): Promise<void> {
    // Default: no-op, providers can override for batch efficiency
  }
}
