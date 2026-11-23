import { BrokerType } from '../types/broker'
import { GenericTransaction } from '../types/transaction'
import type { ImportOverlap } from '../types/cgt'

/**
 * The file a transaction was imported from, from its ID.
 *
 * Parsers build IDs as `${fileId}-${rowIndex}` (Interactive Brokers option
 * expiries use `${fileId}-exp-${rowIndex}`). Returns null for IDs that don't
 * follow the pattern, such as auto-fetched splits.
 */
export function getImportFileId(transactionId: string): string | null {
  if (transactionId.startsWith('auto-split-')) return null
  const match = /^(.+?)-(?:exp-)?\d+$/.exec(transactionId)
  return match ? match[1] : null
}

function overlapKey(tx: GenericTransaction): string {
  return JSON.stringify([
    tx.source, tx.type, tx.date, tx.symbol, tx.currency,
    tx.quantity, tx.price, tx.total, tx.fee, tx.ratio ?? null,
  ])
}

/**
 * Removes rows that appear in more than one imported file.
 *
 * Users often import overlapping exports from the same broker, such as a
 * "2023" statement and a "2022-2024" statement. The duplicate-file check only
 * compares file name and size, so without this every overlapping trade would
 * be counted twice: double proceeds, double cost and a doubled pool.
 *
 * Rows match when every recorded field is identical (broker, type, date,
 * symbol, currency, quantity, price, total, fee, split ratio). Identical rows
 * within one file are kept, since separate fills at the same price are real.
 * Across files, the file with the most copies of a row is kept and the copies
 * in other files are dropped.
 *
 * Limitation: two separate accounts at the same broker, imported as separate
 * files, that make exactly the same trade on the same day will be merged.
 */
export function removeOverlappingImports(transactions: GenericTransaction[]): GenericTransaction[] {
  return findOverlappingImports(transactions).kept
}

/**
 * Splits transactions into the rows kept and the rows removed as overlapping
 * imports (see removeOverlappingImports), so the removed rows can be shown to
 * the user. `overlaps` summarises them per pair of files: which file's copy
 * was dropped, which was kept, how many rows and their date range.
 */
export function findOverlappingImports(
  transactions: GenericTransaction[]
): { kept: GenericTransaction[]; removed: GenericTransaction[]; overlaps: ImportOverlap[] } {
  const groups = new Map<string, Map<string, GenericTransaction[]>>()

  for (const tx of transactions) {
    const fileId = getImportFileId(tx.id)
    if (fileId === null) continue

    const key = overlapKey(tx)
    let byFile = groups.get(key)
    if (!byFile) {
      byFile = new Map()
      groups.set(key, byFile)
    }
    const rows = byFile.get(fileId)
    if (rows) {
      rows.push(tx)
    } else {
      byFile.set(fileId, [tx])
    }
  }

  const dropped = new Set<GenericTransaction>()
  // One summary per (dropped file, kept file) pair, so the UI can name both
  const overlaps = new Map<string, ImportOverlap>()
  for (const byFile of groups.values()) {
    if (byFile.size < 2) continue

    let keepFile: string | null = null
    let keepCount = 0
    for (const [fileId, rows] of byFile) {
      if (rows.length > keepCount) {
        keepFile = fileId
        keepCount = rows.length
      }
    }

    for (const [fileId, rows] of byFile) {
      if (fileId === keepFile || keepFile === null) continue
      const pairKey = JSON.stringify([fileId, keepFile])
      let overlap = overlaps.get(pairKey)
      if (!overlap) {
        overlap = { droppedFileId: fileId, keptFileId: keepFile, rows: 0, firstDate: rows[0].date, lastDate: rows[0].date }
        overlaps.set(pairKey, overlap)
      }
      for (const tx of rows) {
        dropped.add(tx)
        overlap.rows++
        if (tx.date < overlap.firstDate) overlap.firstDate = tx.date
        if (tx.date > overlap.lastDate) overlap.lastDate = tx.date
      }
    }
  }

  if (dropped.size === 0) return { kept: transactions, removed: [], overlaps: [] }
  return {
    kept: transactions.filter(tx => !dropped.has(tx)),
    removed: transactions.filter(tx => dropped.has(tx)),
    overlaps: [...overlaps.values()].sort((a, b) => b.rows - a.rows),
  }
}

/**
 * Deduplicates transactions: removes rows repeated across overlapping imports
 * (see removeOverlappingImports), then removes Stock Plan Activity
 * transactions when there are corresponding Equity Awards transactions.
 *
 * Stock Plan Activity transactions appear in the standard Schwab export, often with
 * missing price data (though users may manually add prices). When users also import
 * the Equity Awards file, we have more complete data for those same transactions.
 * This function filters out the duplicates, preferring Equity Awards data.
 *
 * Matching criteria:
 * - Same symbol
 * - Stock Plan Activity date is on same day or up to 6 days after Equity Awards date
 *   (settlement vs transaction date difference)
 * - Same quantity (if both have quantity)
 *
 * @param transactions Array of all loaded transactions
 * @returns Array with Stock Plan Activity removed when Equity Awards coverage exists
 */
export function deduplicateTransactions(allTransactions: GenericTransaction[]): GenericTransaction[] {
  const transactions = removeOverlappingImports(allTransactions)

  // Helper function to check if a Stock Plan Activity transaction has Equity Awards coverage
  const hasEquityAwardsCoverage = (tx: GenericTransaction) => {
    if (!tx.symbol) return false

    const txDate = new Date(tx.date)
    return transactions.some(other => {
      if (other.source !== BrokerType.SCHWAB_EQUITY_AWARDS) return false
      if (other.symbol !== tx.symbol) return false

      const otherDate = new Date(other.date)
      const daysDiff = Math.floor((txDate.getTime() - otherDate.getTime()) / (1000 * 60 * 60 * 24))

      // Check if Equity Awards transaction is on the same day or up to 6 days before
      if (daysDiff < 0 || daysDiff > 6) return false

      // If both have quantity, they should match
      if (tx.quantity !== null && other.quantity !== null && tx.quantity !== other.quantity) {
        return false
      }

      return true
    })
  }

  // Check if a transaction is Stock Plan Activity from standard Schwab export
  const isStockPlanActivity = (tx: GenericTransaction) => {
    return tx.source === BrokerType.SCHWAB &&
           tx.notes?.includes('Stock Plan Activity')
  }

  // Filter out Stock Plan Activity transactions that have Equity Awards coverage
  return transactions.filter(tx => {
    // If transaction is incomplete and has Equity Awards coverage, remove it
    if (tx.incomplete && hasEquityAwardsCoverage(tx)) {
      return false
    }
    // If transaction is Stock Plan Activity (even with price) and has Equity Awards coverage, remove it
    if (isStockPlanActivity(tx) && hasEquityAwardsCoverage(tx)) {
      return false
    }
    return true
  })
}
