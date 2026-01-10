import { GenericTransaction } from '../types/transaction'

/**
 * Deduplicates transactions by removing Stock Plan Activity transactions
 * when there are corresponding Equity Awards transactions.
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
export function deduplicateTransactions(transactions: GenericTransaction[]): GenericTransaction[] {
  // Helper function to check if a Stock Plan Activity transaction has Equity Awards coverage
  const hasEquityAwardsCoverage = (tx: GenericTransaction) => {
    if (!tx.symbol) return false

    const txDate = new Date(tx.date)
    return transactions.some(other => {
      if (other.source !== 'Charles Schwab Equity Awards') return false
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
    return tx.source === 'Charles Schwab' &&
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
