import { GenericTransaction } from '../types/transaction'

/**
 * Deduplicates transactions by removing incomplete Stock Plan Activity transactions
 * when there are corresponding Equity Awards transactions within 6 days before.
 *
 * Stock Plan Activity transactions often appear in the standard Schwab export with
 * missing price data. When users also import the Equity Awards file, we have complete
 * data for those same transactions. This function filters out the incomplete duplicates.
 *
 * @param transactions Array of all loaded transactions
 * @returns Array with incomplete transactions removed when Equity Awards coverage exists
 */
export function deduplicateTransactions(transactions: GenericTransaction[]): GenericTransaction[] {
  // Helper function to check if an incomplete transaction has Equity Awards coverage
  const hasEquityAwardsCoverage = (tx: GenericTransaction) => {
    if (!tx.incomplete || !tx.symbol) return false

    const txDate = new Date(tx.date)
    return transactions.some(other => {
      if (other.source !== 'Charles Schwab Equity Awards') return false
      if (other.symbol !== tx.symbol) return false

      const otherDate = new Date(other.date)
      const daysDiff = Math.floor((txDate.getTime() - otherDate.getTime()) / (1000 * 60 * 60 * 24))

      // Check if Equity Awards transaction is on the same day or up to 6 days before
      return daysDiff >= 0 && daysDiff <= 6
    })
  }

  // Filter out incomplete transactions that have Equity Awards coverage
  return transactions.filter(tx => {
    // If transaction is incomplete and has Equity Awards coverage, remove it
    if (tx.incomplete && hasEquityAwardsCoverage(tx)) {
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
