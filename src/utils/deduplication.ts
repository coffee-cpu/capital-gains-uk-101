import { GenericTransaction } from '../types/transaction'

/**
 * Deduplicate incomplete Schwab Stock Plan Activity transactions when
 * complete Equity Awards data is available.
 *
 * Strategy:
 * - Incomplete transactions have `incomplete: true` and a `matchKey`
 * - Complete Equity Awards transactions have the same `matchKey`
 * - When both exist, remove the incomplete one
 *
 * @param transactions Array of all loaded transactions
 * @returns Filtered array with duplicates removed
 */
export function deduplicateTransactions(transactions: GenericTransaction[]): GenericTransaction[] {
  // Build a set of match keys from complete transactions
  const completeMatchKeys = new Set<string>()

  for (const tx of transactions) {
    if (tx.matchKey && !tx.incomplete) {
      completeMatchKeys.add(tx.matchKey)
    }
  }

  // Filter out incomplete transactions that have matching complete ones
  return transactions.filter(tx => {
    // Keep all transactions that aren't incomplete
    if (!tx.incomplete) {
      return true
    }

    // For incomplete transactions, only keep if no matching complete transaction exists
    if (tx.matchKey && completeMatchKeys.has(tx.matchKey)) {
      return false // Remove this incomplete transaction
    }

    return true // Keep incomplete transactions that don't have matches
  })
}

/**
 * Check if there are any incomplete Stock Plan Activity transactions
 * that need Equity Awards data
 *
 * @param transactions Array of transactions to check
 * @returns Array of incomplete transaction symbols that need Equity Awards data
 */
export function getIncompleteStockPlanActivity(transactions: GenericTransaction[]): string[] {
  const incompleteSymbols = new Set<string>()

  for (const tx of transactions) {
    if (tx.incomplete && tx.symbol) {
      incompleteSymbols.add(tx.symbol)
    }
  }

  return Array.from(incompleteSymbols)
}
