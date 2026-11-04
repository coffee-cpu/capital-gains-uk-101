import { FXProvider, FXRateResult, FXSource, FXSourceAttributions } from '../../../types/fxSource'
import { getFxRateCache } from '../../cache'

/**
 * The source answered and has no rate for this currency and period (as
 * opposed to the source being unreachable). A stale cached rate must not
 * stand in for it: it may be a value the source deliberately leaves out.
 */
export class RateNotPublishedError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RateNotPublishedError'
  }
}

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

    // Check cache first
    const cached = await getFxRateCache().get(cacheKey)
    if (cached && this.isCachedRateUsable(cached.source)) {
      return this.createResult(cached.rate, date, currency, cached.source)
    }

    // Fetch from API. A cached rate the provider wanted to refresh still
    // beats no rate when the source can't be reached (offline), but not when
    // the source says it has no such rate
    let rate: number
    try {
      rate = await this.fetchRate(date, currency)
    } catch (error) {
      if (cached && !(error instanceof RateNotPublishedError)) {
        return this.createResult(cached.rate, date, currency, cached.source)
      }
      throw error
    }

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
   * Whether a cached rate can be reused. Providers override this to refetch
   * rates cached by an older version from a source they no longer prefer.
   */
  protected isCachedRateUsable(_source: string | undefined): boolean {
    return true
  }

  /**
   * Where a rate for this date came from, shown next to converted values.
   * Providers that can fall back to another host override this.
   */
  protected sourceAttribution(_dateKey: string): string {
    return FXSourceAttributions[this.fxSource]
  }

  /**
   * Create a standardized FX rate result
   *
   * @param source Attribution stored with a cached rate, if any
   */
  protected createResult(rate: number, date: string, currency: string, source?: string): FXRateResult {
    const dateKey = this.getDateKey(date)
    return {
      rate,
      dateKey,
      currency,
      fxSource: this.fxSource,
      source: source || this.sourceAttribution(dateKey),
    }
  }

  /**
   * Cache the rate
   */
  protected async cacheRate(
    cacheKey: string,
    date: string,
    currency: string,
    rate: number
  ): Promise<void> {
    await getFxRateCache().put({
      id: cacheKey,
      date: this.getDateKey(date),
      currency,
      rate,
      source: this.sourceAttribution(this.getDateKey(date)),
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
