import { EnrichedTransaction } from '../../../types/transaction'
import { FXSource, FXSourceAttributions, DEFAULT_FX_SOURCE } from '../../../types/fxSource'
import { FXManager, convertToGBP } from '../../fx'
import { Enricher } from '../types'

/**
 * FX Enricher
 *
 * Converts transaction amounts to GBP using the selected FX conversion source.
 * Supports multiple sources: HMRC Monthly, HMRC Yearly Average, Daily Spot (ECB).
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

  constructor(fxSource?: FXSource) {
    this.fxManager = new FXManager(fxSource ?? DEFAULT_FX_SOURCE)
  }

  /**
   * Get the current FX source
   */
  getFXSource(): FXSource {
    return this.fxManager.getFXSource()
  }

  /**
   * Set the FX source - use before enrichment
   */
  setFXSource(fxSource: FXSource): void {
    this.fxManager.setFXSource(fxSource)
  }

  async enrich(transactions: EnrichedTransaction[]): Promise<EnrichedTransaction[]> {
    // Prefetch rates for efficiency (especially helpful for daily rates)
    try {
      await this.fxManager.prefetchForTransactions(transactions)
    } catch (error) {
      console.warn('FX rate prefetch failed, will fetch individually:', error)
    }

    const enriched: EnrichedTransaction[] = []
    const fxSource = this.fxManager.getFXSource()

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
          fx_source: tx.currency === 'GBP' ? 'Native GBP' : FXSourceAttributions[fxSource],
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
