import { GenericTransaction, EnrichedTransaction } from '../types/transaction'
import { getFXRate, convertToGBP } from './fxRates'
import { getTaxYear } from '../utils/taxYear'
import { applySplitNormalization } from './splits/normalization'

/**
 * Enrich transactions with GBP conversions and tax year information
 *
 * Per HMRC TCGA92/S127, stock splits are processed first to normalize
 * all quantities to the most recent split-adjusted units. This ensures
 * accurate cost basis calculations and CGT matching.
 *
 * @param transactions Array of generic transactions
 * @returns Array of enriched transactions with FX rates and GBP values
 */
export async function enrichTransactions(
  transactions: GenericTransaction[]
): Promise<EnrichedTransaction[]> {
  // Step 1: Apply split normalization first
  // This adjusts quantities and prices for all transactions that occurred before splits
  const normalized = applySplitNormalization(transactions)

  const enriched: EnrichedTransaction[] = []

  for (const tx of normalized) {
    try {
      // Fetch FX rate for this transaction's date and currency
      const fxRate = await getFXRate(tx.date, tx.currency)

      // Convert prices to GBP
      const priceGbp = tx.price !== null ? convertToGBP(tx.price, fxRate) : null
      const valueGbp = tx.total !== null ? convertToGBP(tx.total, fxRate) : null
      const feeGbp = tx.fee !== null ? convertToGBP(tx.fee, fxRate) : null

      // Calculate tax year
      const taxYear = getTaxYear(tx.date)

      enriched.push({
        ...tx,
        fx_rate: fxRate,
        price_gbp: priceGbp,
        value_gbp: valueGbp,
        fee_gbp: feeGbp,
        fx_source: tx.currency === 'GBP' ? 'Native GBP' : 'HMRC',
        fx_error: null,
        tax_year: taxYear,
        gain_group: 'NONE', // Will be set by CGT engine later
      })
    } catch (error) {
      console.error(`Failed to enrich transaction ${tx.id}:`, error)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching FX rate'

      // Mark transaction with error - no fallback values
      enriched.push({
        ...tx,
        fx_rate: 0,
        price_gbp: null,
        value_gbp: null,
        fee_gbp: null,
        fx_source: 'Failed',
        fx_error: errorMessage,
        tax_year: getTaxYear(tx.date),
        gain_group: 'NONE',
      })
    }
  }

  return enriched
}
