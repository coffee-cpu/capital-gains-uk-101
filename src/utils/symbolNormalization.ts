import { GenericTransaction } from '../types/transaction'

/**
 * Known symbol renames in stock market history.
 * Maps old symbol -> new symbol with the date of change.
 *
 * When normalizing, we always convert to the NEW symbol regardless of transaction date,
 * since HMRC reporting uses current symbol names.
 */
const SYMBOL_RENAMES: { [oldSymbol: string]: { newSymbol: string; changeDate: string } } = {
  'FB': { newSymbol: 'META', changeDate: '2022-06-09' }, // Facebook -> Meta Platforms
}

/**
 * Normalize a symbol to its current ticker name.
 *
 * For example:
 * - "FB" transactions from any date should be stored as "META"
 * - "META" transactions remain as "META"
 *
 * @param symbol The original symbol from the CSV
 * @returns The normalized (current) symbol, or the input if no normalization needed (null/empty returns as-is)
 */
export function normalizeSymbol(symbol: string | null): string | null {
  if (!symbol || symbol.trim() === '') return symbol

  // Check if this symbol has been renamed
  const rename = SYMBOL_RENAMES[symbol]
  if (rename) {
    return rename.newSymbol
  }

  return symbol
}

/**
 * Normalize symbols in an array of transactions.
 * This is a separate processing pass that runs after CSV parsing.
 *
 * @param transactions Array of transactions to normalize
 * @returns New array with normalized symbols
 */
export function normalizeTransactionSymbols(transactions: GenericTransaction[]): GenericTransaction[] {
  return transactions.map(tx => {
    const normalizedSymbol = normalizeSymbol(tx.symbol)
    if (normalizedSymbol === tx.symbol) {
      // No change needed, return original object
      return tx
    }
    // Symbol was renamed, return new object with normalized symbol
    return {
      ...tx,
      symbol: normalizedSymbol || ''
    }
  })
}

/**
 * Add a new symbol rename to the registry.
 * Useful for testing or future extensibility.
 *
 * @param oldSymbol The historical symbol
 * @param newSymbol The current symbol
 * @param changeDate The date of the rename (YYYY-MM-DD)
 */
export function addSymbolRename(oldSymbol: string, newSymbol: string, changeDate: string) {
  SYMBOL_RENAMES[oldSymbol] = { newSymbol, changeDate }
}

/**
 * Get all registered symbol renames.
 * Useful for debugging and testing.
 */
export function getSymbolRenames() {
  return { ...SYMBOL_RENAMES }
}
