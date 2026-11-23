import { FXProvider, FXRateResult, FXSource } from '../../types/fxSource'
import { GenericTransaction } from '../../types/transaction'
import { isFiatCurrency } from '../currencies'
import { HMRCMonthlyProvider } from './providers/hmrcMonthly'
import { HMRCYearlyProvider } from './providers/hmrcYearly'
import { DailySpotProvider } from './providers/dailySpot'

/**
 * FX rates for GBP conversion, from one source.
 *
 * HMRC Guidance (CG78310):
 * "HMRC does not prescribe what reference point should be used for the exchange rate.
 * It is, however, expected that a reasonable and consistent method is used."
 *
 * @see https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg78310
 */

/** The provider for an FX source */
export function createFXProvider(fxSource: FXSource): FXProvider {
  switch (fxSource) {
    case 'HMRC_MONTHLY': return new HMRCMonthlyProvider()
    case 'HMRC_YEARLY_AVG': return new HMRCYearlyProvider()
    case 'DAILY_SPOT': return new DailySpotProvider()
  }
}

/**
 * Looks up rates from one provider, sharing each lookup between the
 * transactions that need it (so each rate is fetched once per run).
 */
export class FXManager {
  /** Lookups by the provider's cache key; a failed lookup is dropped so it can be retried */
  private rateCache = new Map<string, Promise<FXRateResult>>()

  constructor(private readonly provider: FXProvider) {}

  /** Exchange rate for a date and currency */
  getRate(date: string, currency: string): Promise<FXRateResult> {
    const cacheKey = this.provider.getCacheKey(date, currency)

    let ratePromise = this.rateCache.get(cacheKey)
    if (!ratePromise) {
      ratePromise = this.provider.getRate(date, currency)
      this.rateCache.set(cacheKey, ratePromise)
      ratePromise.catch(() => {
        this.rateCache.delete(cacheKey)
      })
    }

    return ratePromise
  }

  /**
   * Prefetch rates for the date range and fiat currencies of a set of
   * transactions, when the provider supports batch fetching
   */
  async prefetchForTransactions(transactions: GenericTransaction[]): Promise<void> {
    if (!this.provider.prefetchRates) return

    const dates: string[] = []
    const currencies = new Set<string>()

    for (const tx of transactions) {
      if (tx.currency !== 'GBP' && isFiatCurrency(tx.currency)) {
        dates.push(tx.date)
        currencies.add(tx.currency)
      }
    }

    if (dates.length === 0) return

    dates.sort()
    await this.provider.prefetchRates(dates[0], dates[dates.length - 1], [...currencies])
  }
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
