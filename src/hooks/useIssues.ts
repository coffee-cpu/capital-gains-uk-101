import { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/db'
import { findDataIssues, type DataIssue, type DataIssueCode } from '../lib/issues'
import { useTransactionStore, selectTransactions } from '../stores/transactionStore'
import type { EnrichedTransaction } from '../types/transaction'
import type { CGTCalculationResult } from '../types/cgt'

/** An issue shown in the Issues panel (the same list the CLI reports as warnings) */
export type Issue = DataIssue

/**
 * Issues the engine finds that the panel doesn't list (yet). Remove a code to
 * show it. Skipped rows are reported in the import message and aren't kept
 * after import, so that one never reaches the panel anyway.
 */
const HIDDEN_ON_WEB: ReadonlySet<DataIssueCode> = new Set([
  'UNKNOWN_TRANSACTION_TYPE',
  'SKIPPED_ROWS',
  // Mentioned in the "Stock Split Without a Ratio" advice instead
  'SPLIT_DATA_UNAVAILABLE',
])

/**
 * The issues to show, errors first, then warnings, then notices
 * Exported for testing purposes
 */
export function detectIssues(
  transactions: EnrichedTransaction[],
  cgtResults: CGTCalculationResult | null,
  /** Imported file names by file ID, to name files in notices (falls back to the ID) */
  fileNames: ReadonlyMap<string, string> = new Map()
): Issue[] {
  if (transactions.length === 0) return []
  return findDataIssues({
    transactions,
    // All tax years, not just the selected one
    disposals: cgtResults?.disposals ?? [],
    dataNotices: cgtResults?.dataNotices,
    metadata: cgtResults?.metadata,
    fileNames,
  }).filter(issue => !HIDDEN_ON_WEB.has(issue.code))
}

/**
 * Hook to aggregate all issues from transactions and CGT results
 *
 * Returns issues sorted by severity (errors first, then warnings, then info)
 */
export function useIssues(): Issue[] {
  const transactions = useTransactionStore(selectTransactions)
  const cgtResults = useTransactionStore((state) => state.cgtResults)
  const [fileNames, setFileNames] = useState<ReadonlyMap<string, string>>(() => new Map())

  // Every import or clear recalculates, so reload the file names with the results
  useEffect(() => {
    let cancelled = false
    db.imported_files.toArray()
      .then(files => {
        if (!cancelled) setFileNames(new Map(files.map(f => [f.fileId, f.filename])))
      })
      .catch(() => { /* names are optional; notices fall back to file IDs */ })
    return () => { cancelled = true }
  }, [cgtResults])

  return useMemo(
    () => detectIssues(transactions, cgtResults, fileNames),
    [transactions, cgtResults, fileNames]
  )
}
