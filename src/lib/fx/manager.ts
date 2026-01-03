import {
  FXProvider,
  FXRateResult,
  FXStrategy,
  DEFAULT_FX_STRATEGY,
} from '../../types/fxStrategy'
import { GenericTransaction } from '../../types/transaction'
import { HMRCMonthlyProvider } from './providers/hmrcMonthly'
import { HMRCYearlyProvider } from './providers/hmrcYearly'
import { DailySpotProvider } from './providers/dailySpot'

/**
 * FX Manager
 *
 * Orchestrates FX rate fetching using the selected strategy.
 * Provides a unified interface for getting rates and prefetching.
 */
export class FXManager {
  private providers: Map<FXStrategy, FXProvider>
  private currentStrategy: FXStrategy

  // In-memory cache to prevent duplicate requests during enrichment
  private rateCache = new Map<string, Promise<FXRateResult>>()

  constructor(strategy: FXStrategy = DEFAULT_FX_STRATEGY) {
    this.currentStrategy = strategy
    this.providers = new Map<FXStrategy, FXProvider>()
    this.providers.set('HMRC_MONTHLY', new HMRCMonthlyProvider())
    this.providers.set('HMRC_YEARLY_AVG', new HMRCYearlyProvider())
    this.providers.set('DAILY_SPOT', new DailySpotProvider())
  }

  /**
   * Get the current strategy
   */
  getStrategy(): FXStrategy {
    return this.currentStrategy
  }

  /**
   * Set the strategy - clears in-memory cache
   */
  setStrategy(strategy: FXStrategy): void {
    if (this.currentStrategy !== strategy) {
      this.currentStrategy = strategy
      this.rateCache.clear()
    }
  }

  /**
   * Get the current provider
   */
  private getProvider(): FXProvider {
    const provider = this.providers.get(this.currentStrategy)
    if (!provider) {
      throw new Error(`Unknown FX strategy: ${this.currentStrategy}`)
    }
    return provider
  }

  /**
   * Get exchange rate for a specific date and currency
   * Uses in-memory caching to prevent duplicate requests during enrichment
   */
  async getRate(date: string, currency: string): Promise<FXRateResult> {
    const provider = this.getProvider()
    const cacheKey = `${this.currentStrategy}-${provider.getCacheKey(date, currency)}`

    // Check in-memory cache first
    let ratePromise = this.rateCache.get(cacheKey)

    if (!ratePromise) {
      ratePromise = provider.getRate(date, currency)
      this.rateCache.set(cacheKey, ratePromise)
    }

    return ratePromise
  }

  /**
   * Prefetch rates for a set of transactions
   * Groups transactions by date range and currencies for efficient batch fetching
   */
  async prefetchForTransactions(transactions: GenericTransaction[]): Promise<void> {
    const provider = this.getProvider()

    // Only prefetch if provider supports it
    if (!provider.prefetchRates) {
      return
    }

    // Extract unique dates and currencies
    const dates: string[] = []
    const currencies = new Set<string>()

    for (const tx of transactions) {
      if (tx.currency !== 'GBP') {
        dates.push(tx.date)
        currencies.add(tx.currency)
      }
    }

    if (dates.length === 0 || currencies.size === 0) {
      return
    }

    // Sort dates to find range
    const sortedDates = [...new Set(dates)].sort()
    const startDate = sortedDates[0]
    const endDate = sortedDates[sortedDates.length - 1]

    await provider.prefetchRates(startDate, endDate, [...currencies])
  }

  /**
   * Clear the in-memory rate cache
   */
  clearCache(): void {
    this.rateCache.clear()
  }
}

/**
 * Singleton instance for shared use
 */
let defaultManager: FXManager | null = null

/**
 * Get the default FX Manager instance
 */
export function getDefaultFXManager(): FXManager {
  if (!defaultManager) {
    defaultManager = new FXManager()
  }
  return defaultManager
}

/**
 * Reset the default FX Manager (for testing)
 */
export function resetDefaultFXManager(): void {
  defaultManager = null
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
