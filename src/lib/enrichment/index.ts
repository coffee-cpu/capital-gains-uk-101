import { GenericTransaction, EnrichedTransaction } from '../../types/transaction'
import { FXStrategy, DEFAULT_FX_STRATEGY } from '../../types/fxStrategy'
import { EnrichmentEngine } from './engine'
import { SplitEnricher } from './enrichers/splitEnricher'
import { FxEnricher } from './enrichers/fxEnricher'
import { TaxYearEnricher } from './enrichers/taxYearEnricher'

// Singleton enricher instances to maintain in-memory caches across enrichment runs
const splitEnricher = new SplitEnricher()
const taxYearEnricher = new TaxYearEnricher()

// FX enricher is created per-call to support different strategies
// but we cache instances by strategy to maintain rate caches
const fxEnricherCache = new Map<FXStrategy, FxEnricher>()

function getFxEnricher(strategy: FXStrategy): FxEnricher {
  let enricher = fxEnricherCache.get(strategy)
  if (!enricher) {
    enricher = new FxEnricher(strategy)
    fxEnricherCache.set(strategy, enricher)
  }
  return enricher
}

/**
 * Enrich transactions with computed fields
 *
 * Enrichment happens in three stages:
 * 1. Stock split adjustments (HMRC TCGA92/S127) - normalize quantities to post-split units
 * 2. FX conversion - convert to GBP using selected strategy
 * 3. Tax year calculation - assign UK tax years
 *
 * Uses singleton enricher instances to maintain in-memory caches (e.g., FX rates)
 * across multiple enrichment runs for better performance.
 *
 * @param transactions Array of generic transactions (raw parsed data from CSV)
 * @param fxStrategy Optional FX strategy to use (defaults to HMRC_MONTHLY)
 * @returns Array of enriched transactions with all computed fields
 */
export async function enrichTransactions(
  transactions: GenericTransaction[],
  fxStrategy: FXStrategy = DEFAULT_FX_STRATEGY
): Promise<EnrichedTransaction[]> {
  // Get the FX enricher for the selected strategy
  const fxEnricher = getFxEnricher(fxStrategy)

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
