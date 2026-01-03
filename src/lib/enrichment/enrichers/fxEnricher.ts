import { EnrichedTransaction } from '../../../types/transaction'
import { FXStrategy, FXStrategySources, DEFAULT_FX_STRATEGY } from '../../../types/fxStrategy'
import { FXManager, convertToGBP } from '../../fx'
import { Enricher } from '../types'

/**
 * FX Enricher
 *
 * Converts transaction amounts to GBP using the selected FX conversion strategy.
 * Supports multiple strategies: HMRC Monthly, HMRC Yearly Average, Daily Spot (ECB).
 *
 * HMRC Guidance (CG78310):
 * "HMRC does not prescribe what reference point should be used for the exchange rate.
 * It is, however, expected that a reasonable and consistent method is used."
 *
 * Populates fields:
 * - fx_rate
 * - price_gbp
 * - value_gbp
 * - fee_gbp
 * - fx_source
 * - fx_error (if rate fetch fails)
 *
 * @see https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg78310
 */
export class FxEnricher implements Enricher {
  name = 'FxEnricher'

  private fxManager: FXManager

  constructor(strategy?: FXStrategy) {
    this.fxManager = new FXManager(strategy ?? DEFAULT_FX_STRATEGY)
  }

  /**
   * Get the current FX strategy
   */
  getStrategy(): FXStrategy {
    return this.fxManager.getStrategy()
  }

  /**
   * Set the FX strategy - use before enrichment
   */
  setStrategy(strategy: FXStrategy): void {
    this.fxManager.setStrategy(strategy)
  }

  async enrich(transactions: EnrichedTransaction[]): Promise<EnrichedTransaction[]> {
    // Prefetch rates for efficiency (especially helpful for daily rates)
    try {
      await this.fxManager.prefetchForTransactions(transactions)
    } catch (error) {
      console.warn('FX rate prefetch failed, will fetch individually:', error)
    }

    const enriched: EnrichedTransaction[] = []
    const strategy = this.fxManager.getStrategy()

    for (const tx of transactions) {
      try {
        // Fetch FX rate for this transaction's date and currency
        const fxResult = await this.fxManager.getRate(tx.date, tx.currency)
        const fxRate = fxResult.rate

        // Convert prices to GBP
        const priceGbp = tx.price !== null ? convertToGBP(tx.price, fxRate) : null
        const splitAdjustedPriceGbp =
          tx.split_adjusted_price !== null && tx.split_adjusted_price !== undefined
            ? convertToGBP(tx.split_adjusted_price, fxRate)
            : null
        const valueGbp = tx.total !== null ? convertToGBP(tx.total, fxRate) : null
        const feeGbp = tx.fee !== null ? convertToGBP(tx.fee, fxRate) : null

        enriched.push({
          ...tx,
          fx_rate: fxRate,
          price_gbp: priceGbp,
          split_adjusted_price_gbp: splitAdjustedPriceGbp,
          value_gbp: valueGbp,
          fee_gbp: feeGbp,
          fx_source: tx.currency === 'GBP' ? 'Native GBP' : FXStrategySources[strategy],
          fx_error: null,
        })
      } catch (error) {
        console.error(`Failed to enrich transaction ${tx.id}:`, error)

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error fetching FX rate'

        // Mark transaction with error - no fallback values
        enriched.push({
          ...tx,
          fx_rate: 0,
          price_gbp: null,
          split_adjusted_price_gbp: null,
          value_gbp: null,
          fee_gbp: null,
          fx_source: 'Failed',
          fx_error: errorMessage,
        })
      }
    }

    return enriched
  }
}
