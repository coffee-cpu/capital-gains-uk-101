import { db } from './db'
import { runPipeline } from './pipeline'
import { FXSource, DEFAULT_FX_SOURCE } from '../types/fxSource'
import { CGTCalculationResult } from '../types/cgt'

/**
 * Process transactions from IndexedDB through the full pipeline
 * (deduplication, auto-splits, enrichment, CGT calculation — see `runPipeline`).
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
  const rawTransactions = await db.transactions.toArray()
  return runPipeline(rawTransactions, { fxSource, autoSplits: autoSplitsEnabled })
}
