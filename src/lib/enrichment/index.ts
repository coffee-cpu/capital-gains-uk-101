import { GenericTransaction, EnrichedTransaction } from '../../types/transaction'
import { FXSource, DEFAULT_FX_SOURCE } from '../../types/fxSource'
import { EnrichmentEngine } from './engine'
import { SplitEnricher } from './enrichers/splitEnricher'
import { FxEnricher } from './enrichers/fxEnricher'
import { TaxYearEnricher } from './enrichers/taxYearEnricher'

// Singleton enricher instances to maintain in-memory caches across enrichment runs
const splitEnricher = new SplitEnricher()
const taxYearEnricher = new TaxYearEnricher()

// FX enricher is created per-call to support different sources
// but we cache instances by source to maintain rate caches
const fxEnricherCache = new Map<FXSource, FxEnricher>()

function getFxEnricher(fxSource: FXSource): FxEnricher {
  let enricher = fxEnricherCache.get(fxSource)
  if (!enricher) {
    enricher = new FxEnricher(fxSource)
    fxEnricherCache.set(fxSource, enricher)
  }
  return enricher
}

/**
 * Enrich transactions with computed fields
 *
 * Enrichment happens in three stages:
 * 1. Stock split adjustments (HMRC TCGA92/S127) - normalize quantities to post-split units
 * 2. FX conversion - convert to GBP using selected source
 * 3. Tax year calculation - assign UK tax years
 *
 * Uses singleton enricher instances to maintain in-memory caches (e.g., FX rates)
 * across multiple enrichment runs for better performance.
 *
 * @param transactions Array of generic transactions (raw parsed data from CSV)
 * @param fxSource Optional FX source to use (defaults to HMRC_MONTHLY)
 * @returns Array of enriched transactions with all computed fields
 */
export async function enrichTransactions(
  transactions: GenericTransaction[],
  fxSource: FXSource = DEFAULT_FX_SOURCE
): Promise<EnrichedTransaction[]> {
  // Get the FX enricher for the selected source
  const fxEnricher = getFxEnricher(fxSource)

  // Create enrichment engine with enrichers
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
