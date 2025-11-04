import { EnrichedTransaction } from '../../types/transaction'

/**
 * Enricher interface for the enrichment pipeline
 *
 * Each enricher processes EnrichedTransaction[] and returns EnrichedTransaction[]
 * with additional fields populated. Enrichers run sequentially, so later enrichers
 * can depend on fields populated by earlier ones.
 */
export interface Enricher {
  /** Human-readable name for logging and debugging */
  name: string

  /**
   * Enrich transactions by populating computed fields
   *
   * @param transactions Array of transactions to enrich (may already have some fields populated)
   * @returns Promise of enriched transactions with additional fields populated
   */
  enrich(transactions: EnrichedTransaction[]): Promise<EnrichedTransaction[]>
}
