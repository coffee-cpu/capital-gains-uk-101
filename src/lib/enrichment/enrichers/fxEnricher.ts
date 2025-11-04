import { EnrichedTransaction } from '../../../types/transaction'
import { getFXRate, convertToGBP } from '../../fxRates'
import { Enricher } from '../types'

/**
 * FX Enricher
 *
 * Converts transaction amounts to GBP using HMRC official exchange rates.
 * Fetches rates from Bank of England API and caches them in IndexedDB.
 *
 * Populates fields:
 * - fx_rate
 * - price_gbp
 * - value_gbp
 * - fee_gbp
 * - fx_source
 * - fx_error (if rate fetch fails)
 */
export class FxEnricher implements Enricher {
  name = 'FxEnricher'

  async enrich(transactions: EnrichedTransaction[]): Promise<EnrichedTransaction[]> {
    const enriched: EnrichedTransaction[] = []

    for (const tx of transactions) {
      try {
        // Fetch FX rate for this transaction's date and currency
        const fxRate = await getFXRate(tx.date, tx.currency)

        // Convert prices to GBP
        const priceGbp = tx.price !== null ? convertToGBP(tx.price, fxRate) : null
        const splitAdjustedPriceGbp = tx.split_adjusted_price !== null && tx.split_adjusted_price !== undefined
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
          fx_source: tx.currency === 'GBP' ? 'Native GBP' : 'HMRC',
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
