import { GenericTransaction, EnrichedTransaction } from '../../types/transaction'
import { EnrichmentEngine } from './engine'
import { SplitEnricher } from './enrichers/splitEnricher'
import { FxEnricher } from './enrichers/fxEnricher'
import { TaxYearEnricher } from './enrichers/taxYearEnricher'

// Singleton enricher instances to maintain in-memory caches across enrichment runs
const splitEnricher = new SplitEnricher()
const fxEnricher = new FxEnricher()
const taxYearEnricher = new TaxYearEnricher()

/**
 * Enrich transactions with computed fields
 *
 * Enrichment happens in three stages:
 * 1. Stock split adjustments (HMRC TCGA92/S127) - normalize quantities to post-split units
 * 2. FX conversion - convert to GBP using HMRC official rates
 * 3. Tax year calculation - assign UK tax years
 *
 * Uses singleton enricher instances to maintain in-memory caches (e.g., FX rates)
 * across multiple enrichment runs for better performance.
 *
 * @param transactions Array of generic transactions (raw parsed data from CSV)
 * @returns Array of enriched transactions with all computed fields
 */
export async function enrichTransactions(
  transactions: GenericTransaction[]
): Promise<EnrichedTransaction[]> {
  // Create enrichment engine with singleton enrichers
  const engine = new EnrichmentEngine([
    splitEnricher,
    fxEnricher,
    taxYearEnricher,
  ])

  return engine.enrich(transactions)
}

// Export engine and enrichers for advanced usage
export { EnrichmentEngine } from './engine'
export { SplitEnricher } from './enrichers/splitEnricher'
export { FxEnricher } from './enrichers/fxEnricher'
export { TaxYearEnricher } from './enrichers/taxYearEnricher'
export type { Enricher } from './types'
