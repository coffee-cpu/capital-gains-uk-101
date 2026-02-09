import { db } from './db'
import { deduplicateTransactions } from '../utils/deduplication'
import { enrichTransactions } from './enrichment'
import { calculateCGT } from './cgt/engine'
import { getAutoSplitsForTransactions } from './splits/splitLookupService'
import { FXSource, DEFAULT_FX_SOURCE } from '../types/fxSource'
import { CGTCalculationResult } from '../types/cgt'

/**
 * Process transactions from IndexedDB through the full pipeline:
 * 1. Fetch from DB
 * 2. Deduplicate (remove incomplete Stock Plan Activity when Equity Awards exists)
 * 3. Inject auto-fetched stock splits (if enabled)
 * 4. Enrich with FX rates and GBP conversions
 * 5. Calculate CGT with HMRC matching rules
 *
 * This function centralizes the transaction processing logic used by:
 * - App.tsx (initial load / session resume)
 * - FXSourceSelector.tsx (when changing FX source)
 * - CSVImporter.tsx (after importing new files)
 *
 * @param fxSource The FX source to use for currency conversion
 * @param autoSplitsEnabled Whether to auto-fetch stock splits from community data
 * @returns CGT calculation results (or null if no transactions)
 */
export async function processTransactionsFromDB(
  fxSource: FXSource = DEFAULT_FX_SOURCE,
  autoSplitsEnabled: boolean = true
): Promise<CGTCalculationResult | null> {
  // Fetch raw transactions from IndexedDB
  const rawTransactions = await db.transactions.toArray()

  if (rawTransactions.length === 0) {
    return null
  }

  // Deduplicate incomplete Stock Plan Activity when Equity Awards data exists
  const deduplicated = deduplicateTransactions(rawTransactions)

  // Inject auto-fetched stock splits (not persisted, regenerated each run)
  let withAutoSplits = deduplicated
  if (autoSplitsEnabled) {
    const autoSplits = await getAutoSplitsForTransactions(deduplicated)
    if (autoSplits.length > 0) {
      withAutoSplits = [...deduplicated, ...autoSplits]
    }
  }

  // Enrich with FX rates and GBP conversions using selected source
  const enriched = await enrichTransactions(withAutoSplits, fxSource)

  // Calculate CGT with HMRC matching rules
  const cgtResults = calculateCGT(enriched)

  return cgtResults
}
