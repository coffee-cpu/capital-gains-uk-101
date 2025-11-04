import { EnrichedTransaction } from '../../../types/transaction'
import { getTaxYear } from '../../../utils/taxYear'
import { Enricher } from '../types'

/**
 * Tax Year Enricher
 *
 * Calculates UK tax year for each transaction.
 * UK tax years run from April 6 to April 5.
 * Format: "2023/24" means 6 April 2023 to 5 April 2024.
 *
 * Populates fields:
 * - tax_year
 *
 * Note: gain_group and match_groups are populated later by the CGT engine,
 * not during enrichment.
 */
export class TaxYearEnricher implements Enricher {
  name = 'TaxYearEnricher'

  async enrich(transactions: EnrichedTransaction[]): Promise<EnrichedTransaction[]> {
    return transactions.map((tx) => ({
      ...tx,
      tax_year: getTaxYear(tx.date),
    }))
  }
}
