import { deduplicateTransactions } from '../utils/deduplication'
import { enrichTransactions } from './enrichment'
import { calculateCGT } from './cgt/engine'
import { getAutoSplitsForTransactions } from './splits/splitLookupService'
import { SplitDataSource } from './splits/splitDataSource'
import { FXSource, DEFAULT_FX_SOURCE } from '../types/fxSource'
import { CGTCalculationResult } from '../types/cgt'
import { GenericTransaction } from '../types/transaction'

export interface PipelineOptions {
  /** The FX source to use for currency conversion */
  fxSource?: FXSource
  /** Whether to auto-fetch stock splits from community data */
  autoSplits?: boolean
  /** Split data source override (defaults to the jsDelivr CDN) */
  splitSource?: SplitDataSource
}

/**
 * Run raw transactions through the full calculation pipeline:
 * 1. Deduplicate (remove incomplete Stock Plan Activity when Equity Awards exists)
 * 2. Inject auto-fetched stock splits (if enabled)
 * 3. Enrich with FX rates and GBP conversions
 * 4. Calculate CGT with HMRC matching rules
 *
 * Runtime-agnostic: shared by the web app (via `processTransactionsFromDB`)
 * and non-browser callers such as the CLI.
 *
 * @returns CGT calculation results (or null if no transactions)
 */
export async function runPipeline(
  rawTransactions: GenericTransaction[],
  options: PipelineOptions = {}
): Promise<CGTCalculationResult | null> {
  const { fxSource = DEFAULT_FX_SOURCE, autoSplits = true, splitSource } = options

  if (rawTransactions.length === 0) {
    return null
  }

  // Deduplicate incomplete Stock Plan Activity when Equity Awards data exists
  const deduplicated = deduplicateTransactions(rawTransactions)

  // Inject auto-fetched stock splits (not persisted, regenerated each run)
  let withAutoSplits = deduplicated
  if (autoSplits) {
    const fetchedSplits = await getAutoSplitsForTransactions(deduplicated, splitSource)
    if (fetchedSplits.length > 0) {
      withAutoSplits = [...deduplicated, ...fetchedSplits]
    }
  }

  // Enrich with FX rates and GBP conversions using selected source
  const enriched = await enrichTransactions(withAutoSplits, fxSource)

  // Calculate CGT with HMRC matching rules
  return calculateCGT(enriched)
}
