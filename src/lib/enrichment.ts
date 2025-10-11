import { GenericTransaction, EnrichedTransaction } from '../types/transaction'
import { getFXRate, convertToGBP } from './fxRates'
import { getTaxYear } from '../utils/taxYear'

/**
 * Enrich transactions with GBP conversions and tax year information
 *
 * @param transactions Array of generic transactions
 * @returns Array of enriched transactions with FX rates and GBP values
 */
export async function enrichTransactions(
  transactions: GenericTransaction[]
): Promise<EnrichedTransaction[]> {
  const enriched: EnrichedTransaction[] = []

  for (const tx of transactions) {
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
