import type { GenericTransaction } from '../types/transaction'

/** Tickers that refer to one security (same ISIN) and were given one symbol */
export interface SymbolMerge {
  isin: string
  /** The symbol all of them now use */
  symbol: string
  /** The other tickers that were renamed to it */
  mergedSymbols: string[]
}

/** A ticker seen with more than one ISIN: different securities sharing a ticker */
export interface TickerConflict {
  symbol: string
  isins: string[]
}

export interface SymbolMatchResult {
  transactions: GenericTransaction[]
  merges: SymbolMerge[]
  conflicts: TickerConflict[]
}

/**
 * Give each security one symbol across brokers, using ISINs where the
 * imported files have them.
 *
 * The Section 104 pool and the matching rules work per symbol, but brokers
 * don't agree on tickers (e.g. VUSA at one, VUSAL at another), so the same
 * holding could be split into separate pools. Tickers seen with the same ISIN
 * are renamed to the one used most across all imported rows, which keeps the
 * name other brokers' ISIN-less rows (and split data) use. Rows of a renamed
 * ticker without an ISIN follow it, since that ticker only ever meant this
 * security.
 *
 * The reverse also happens: one ticker for two securities (two ISINs). Those
 * rows get the ISIN appended to the symbol so they are pooled separately;
 * rows of that ticker without an ISIN can't be told apart and are left alone.
 */
export function matchSymbolsByIsin(transactions: GenericTransaction[]): SymbolMatchResult {
  const rowsPerSymbol = new Map<string, number>()
  const symbolsByIsin = new Map<string, Set<string>>()
  const isinsBySymbol = new Map<string, Set<string>>()

  for (const tx of transactions) {
    if (!tx.symbol) continue
    rowsPerSymbol.set(tx.symbol, (rowsPerSymbol.get(tx.symbol) ?? 0) + 1)
    if (!tx.isin) continue
    addTo(symbolsByIsin, tx.isin, tx.symbol)
    addTo(isinsBySymbol, tx.symbol, tx.isin)
  }

  const conflictingSymbols = new Set(
    [...isinsBySymbol].filter(([, isins]) => isins.size > 1).map(([symbol]) => symbol)
  )

  const renames = new Map<string, string>()
  const merges: SymbolMerge[] = []
  for (const [isin, symbols] of symbolsByIsin) {
    const candidates = [...symbols].filter(symbol => !conflictingSymbols.has(symbol))
    if (candidates.length < 2) continue

    // Most-used ticker wins; then the shorter, then alphabetical, so the
    // choice doesn't depend on import order
    candidates.sort((a, b) =>
      (rowsPerSymbol.get(b) ?? 0) - (rowsPerSymbol.get(a) ?? 0) || a.length - b.length || a.localeCompare(b)
    )
    const [symbol, ...mergedSymbols] = candidates
    mergedSymbols.forEach(merged => renames.set(merged, symbol))
    merges.push({ isin, symbol, mergedSymbols })
  }

  const conflicts: TickerConflict[] = [...conflictingSymbols].map(symbol => ({
    symbol,
    isins: [...(isinsBySymbol.get(symbol) ?? [])].sort(),
  }))

  if (renames.size === 0 && conflicts.length === 0) {
    return { transactions, merges, conflicts }
  }

  const matched = transactions.map(tx => {
    if (tx.isin && conflictingSymbols.has(tx.symbol)) {
      return { ...tx, symbol: `${tx.symbol} (${tx.isin})` }
    }
    const renamed = renames.get(tx.symbol)
    return renamed ? { ...tx, symbol: renamed } : tx
  })

  return { transactions: matched, merges, conflicts }
}

function addTo(map: Map<string, Set<string>>, key: string, value: string): void {
  const set = map.get(key)
  if (set) set.add(value)
  else map.set(key, new Set([value]))
}
