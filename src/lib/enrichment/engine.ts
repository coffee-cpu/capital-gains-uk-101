import { GenericTransaction, EnrichedTransaction } from '../../types/transaction'
import { Enricher } from './types'

/**
 * Enrichment Engine
 *
 * Orchestrates the enrichment pipeline by:
 * 1. Converting GenericTransaction[] to EnrichedTransaction[] (initializing enriched fields with defaults)
 * 2. Running each enricher sequentially
 * 3. Returning fully enriched transactions
 *
 * Each enricher can depend on fields populated by previous enrichers.
 */
export class EnrichmentEngine {
  constructor(private enrichers: Enricher[]) {}

  /**
   * Enrich transactions using the configured pipeline
   *
   * @param transactions Array of generic transactions (raw parsed data from CSV)
   * @returns Promise of fully enriched transactions
   */
  async enrich(transactions: GenericTransaction[]): Promise<EnrichedTransaction[]> {
    // Step 1: Initialize EnrichedTransaction[] with default values for all enriched fields
    let enriched = this.initializeEnrichedTransactions(transactions)

    // Step 2: Run each enricher in sequence
    for (const enricher of this.enrichers) {
      enriched = await enricher.enrich(enriched)
    }

    return enriched
  }

  /**
   * Convert GenericTransaction[] to EnrichedTransaction[] with default enriched fields
   *
   * All computed fields are initialized to sensible defaults:
   * - Stock split fields: null/empty (no splits applied yet)
   * - FX fields: null/0 (not yet converted)
   * - Tax year fields: empty/NONE (not yet calculated)
   */
  private initializeEnrichedTransactions(
    transactions: GenericTransaction[]
  ): EnrichedTransaction[] {
    return transactions.map((tx) => ({
      ...tx,
      // Stock split adjustments (enrichment pass 1)
      split_adjusted_quantity: null,
      split_adjusted_price: null,
      split_multiplier: 1.0, // No split by default
      applied_splits: [],
      // FX conversion (enrichment pass 2)
      fx_rate: null,
      price_gbp: null,
      value_gbp: null,
      fee_gbp: null,
      fx_source: 'Pending',
      fx_error: null,
      // Tax year and CGT matching (enrichment pass 3)
      tax_year: '',
      gain_group: 'NONE' as const,
      match_groups: [],
    }))
  }
}
