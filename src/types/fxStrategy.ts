import { z } from 'zod'

/**
 * FX Conversion Strategy Types
 *
 * HMRC does not prescribe a specific exchange rate source (CG78310),
 * but requires a "reasonable and consistent method" be used.
 *
 * @see https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg78310
 */

export const FXStrategySchema = z.enum([
  'HMRC_MONTHLY',
  'HMRC_YEARLY_AVG',
  'DAILY_SPOT',
])

export type FXStrategy = z.infer<typeof FXStrategySchema>

/**
 * Human-readable names for each FX strategy
 */
export const FXStrategyDisplayNames: Record<FXStrategy, string> = {
  HMRC_MONTHLY: 'HMRC Monthly Rates',
  HMRC_YEARLY_AVG: 'HMRC Yearly Average',
  DAILY_SPOT: 'Daily Spot Rates (ECB)',
}

/**
 * Descriptions explaining each strategy
 */
export const FXStrategyDescriptions: Record<FXStrategy, string> = {
  HMRC_MONTHLY:
    'Official HMRC rates published monthly. One fixed rate per currency per month.',
  HMRC_YEARLY_AVG:
    'HMRC annual average rates. Simpler calculation, less precise for volatile periods.',
  DAILY_SPOT:
    'European Central Bank daily spot rates. Most accurate for transaction-date conversions.',
}

/**
 * Source attribution for each strategy
 */
export const FXStrategySources: Record<FXStrategy, string> = {
  HMRC_MONTHLY: 'HMRC Monthly Exchange Rates',
  HMRC_YEARLY_AVG: 'HMRC Annual Average Rates',
  DAILY_SPOT: 'European Central Bank (via Frankfurter)',
}

/**
 * Source URLs for reference
 */
export const FXStrategySourceUrls: Record<FXStrategy, string> = {
  HMRC_MONTHLY: 'https://www.trade-tariff.service.gov.uk/exchange_rates/monthly',
  HMRC_YEARLY_AVG: 'https://www.trade-tariff.service.gov.uk/exchange_rates/average',
  DAILY_SPOT: 'https://frankfurter.dev/',
}

/**
 * FX Rate result with metadata
 */
export interface FXRateResult {
  /** The exchange rate (units of foreign currency per 1 GBP) */
  rate: number
  /** The date key this rate applies to (format depends on strategy) */
  dateKey: string
  /** Currency code */
  currency: string
  /** Which strategy was used */
  strategy: FXStrategy
  /** Human-readable source attribution */
  source: string
}

/**
 * FX Provider interface - implemented by each strategy provider
 */
export interface FXProvider {
  /** Which strategy this provider implements */
  readonly strategy: FXStrategy

  /**
   * Get the exchange rate for a specific date and currency
   * @param date ISO date string (YYYY-MM-DD)
   * @param currency Currency code (e.g., 'USD')
   * @returns FX rate result with metadata
   */
  getRate(date: string, currency: string): Promise<FXRateResult>

  /**
   * Optional: Prefetch rates for a date range (efficiency optimization)
   * @param startDate Start of date range (YYYY-MM-DD)
   * @param endDate End of date range (YYYY-MM-DD)
   * @param currencies Array of currency codes to prefetch
   */
  prefetchRates?(startDate: string, endDate: string, currencies: string[]): Promise<void>

  /**
   * Generate cache key for a given date and currency
   */
  getCacheKey(date: string, currency: string): string
}

/**
 * Default FX strategy
 */
export const DEFAULT_FX_STRATEGY: FXStrategy = 'HMRC_MONTHLY'
