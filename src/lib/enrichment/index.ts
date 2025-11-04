import { GenericTransaction, EnrichedTransaction } from '../../types/transaction'
import { EnrichmentEngine } from './engine'
import { SplitEnricher } from './enrichers/splitEnricher'
import { FxEnricher } from './enrichers/fxEnricher'
import { TaxYearEnricher } from './enrichers/taxYearEnricher'

/**
 * Enrich transactions with computed fields
 *
 * Enrichment happens in three stages:
 * 1. Stock split adjustments (HMRC TCGA92/S127) - normalize quantities to post-split units
 * 2. FX conversion - convert to GBP using HMRC official rates
 * 3. Tax year calculation - assign UK tax years
 *
 * @param transactions Array of generic transactions (raw parsed data from CSV)
 * @returns Array of enriched transactions with all computed fields
 */
export async function enrichTransactions(
  transactions: GenericTransaction[]
): Promise<EnrichedTransaction[]> {
  // Create enrichment engine with the standard pipeline
  const engine = new EnrichmentEngine([
    new SplitEnricher(),
    new FxEnricher(),
    new TaxYearEnricher(),
  ])

  return engine.enrich(transactions)
}

// Export engine and enrichers for advanced usage
export { EnrichmentEngine } from './engine'
export { SplitEnricher } from './enrichers/splitEnricher'
export { FxEnricher } from './enrichers/fxEnricher'
export { TaxYearEnricher } from './enrichers/taxYearEnricher'
export type { Enricher } from './types'
