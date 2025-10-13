import { GenericTransaction } from '../types/transaction'

/**
 * Deduplication is no longer needed - Stock Plan Activity transactions are
 * marked as ignored at parse time in the Schwab parser.
 *
 * This function is kept for backwards compatibility but just returns transactions as-is.
 *
 * @param transactions Array of all loaded transactions
 * @returns Array unchanged (deduplication happens at parse time)
 */
export function deduplicateTransactions(transactions: GenericTransaction[]): GenericTransaction[] {
  return transactions
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
