import type { GenericTransaction } from '../types/transaction'

/** Tickers that refer to one security (same ISIN) and were given one symbol */
export interface SymbolMerge {
  isin: string
  /** The symbol all of them now use */
  symbol: string
  /** The other tickers that were renamed to it */
  mergedSymbols: string[]
}

/** A ticker seen with more than one ISIN */
export interface TickerConflict {
  symbol: string
  isins: string[]
  /**
   * True when the ISINs were in use at overlapping times, so the ticker names
   * different securities and rows are pooled per ISIN. False when one ISIN
   * follows the other (typically an ISIN change in a reorganisation, where
   * TCGA92/S127 keeps one holding), so the rows stay in one pool.
   */
  pooledSeparately: boolean
}

/**
 * Rows that change a holding. Only these date an ISIN's period of use:
 * income rows (dividends, interest) can be paid under an old ISIN after a
 * reorganisation and would make sequential ISINs look like they overlap.
 */
const HOLDING_CHANGE_TYPES = new Set<string>([
  'BUY', 'SELL', 'TRANSFER', 'STOCK_SPLIT',
  'OPTIONS_BUY_TO_OPEN', 'OPTIONS_SELL_TO_OPEN', 'OPTIONS_BUY_TO_CLOSE',
  'OPTIONS_SELL_TO_CLOSE', 'OPTIONS_ASSIGNED', 'OPTIONS_EXPIRED',
])

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
 * are renamed to the one used most across imported trades, which keeps the
 * name other brokers' ISIN-less rows use. Rows of a renamed ticker without an
 * ISIN follow it, since that ticker only ever meant this security.
 *
 * One ticker with several ISINs is handled by timing:
 * - ISINs in use at overlapping times mean different securities share the
 *   ticker. Those rows get the ISIN appended to the symbol so they are pooled
 *   separately; rows of that ticker without an ISIN can't be told apart and
 *   are left alone.
 * - ISINs that follow one another are usually one holding whose ISIN changed
 *   (consolidation, redomiciliation), which TCGA92/S127 treats as the same
 *   asset, so the rows stay in one pool. Both cases are reported.
 */
export function matchSymbolsByIsin(transactions: GenericTransaction[]): SymbolMatchResult {
  const rowsPerSymbol = new Map<string, number>()
  const symbolsByIsin = new Map<string, Set<string>>()
  // symbol -> ISIN -> first and last date seen
  const isinDates = new Map<string, Map<string, { first: string; last: string }>>()

  for (const tx of transactions) {
    if (!tx.symbol) continue
    // Split records (including fetched ones) aren't trading activity, so
    // they don't count towards which ticker becomes the name
    if (tx.type !== 'STOCK_SPLIT') {
      rowsPerSymbol.set(tx.symbol, (rowsPerSymbol.get(tx.symbol) ?? 0) + 1)
    }
    if (!tx.isin) continue
    const symbols = symbolsByIsin.get(tx.isin) ?? new Set<string>()
    symbols.add(tx.symbol)
    symbolsByIsin.set(tx.isin, symbols)

    if (!HOLDING_CHANGE_TYPES.has(tx.type)) continue

    const byIsin = isinDates.get(tx.symbol) ?? new Map()
    const range = byIsin.get(tx.isin)
    if (!range) byIsin.set(tx.isin, { first: tx.date, last: tx.date })
    else {
      if (tx.date < range.first) range.first = tx.date
      if (tx.date > range.last) range.last = tx.date
    }
    isinDates.set(tx.symbol, byIsin)
  }

  const conflicts: TickerConflict[] = []
  const splitSymbols = new Set<string>() // overlapping ISINs: pooled per ISIN
  const multiIsinSymbols = new Set<string>() // any symbol with more than one ISIN
  for (const [symbol, byIsin] of isinDates) {
    if (byIsin.size < 2) continue
    multiIsinSymbols.add(symbol)
    // Ordered by first use, so a change reads old to new. Ranges that only
    // touch (old ISIN out and new ISIN in on the same day, the usual way a
    // reorganisation is recorded) are sequential, not overlapping.
    const byFirstUse = [...byIsin].sort(([, a], [, b]) => a.first.localeCompare(b.first))
    const overlapping = byFirstUse.some(([, range], i) => i > 0 && range.first < byFirstUse[i - 1][1].last)
    if (overlapping) splitSymbols.add(symbol)
    conflicts.push({ symbol, isins: byFirstUse.map(([isin]) => isin), pooledSeparately: overlapping })
  }

  const renames = new Map<string, string>()
  const merges: SymbolMerge[] = []
  for (const [isin, symbols] of symbolsByIsin) {
    const candidates = [...symbols].filter(symbol => !splitSymbols.has(symbol))
    if (candidates.length < 2) continue

    // A ticker used across an ISIN change spans several ISIN groups, so it
    // must keep its name: renaming it in one group would move all its rows.
    const anchored = candidates.filter(symbol => multiIsinSymbols.has(symbol))
    if (anchored.length > 1) continue

    // Otherwise the most-used ticker wins; then the shorter, then
    // alphabetical, so the choice doesn't depend on import order
    const symbol = anchored[0] ?? [...candidates].sort((a, b) =>
      (rowsPerSymbol.get(b) ?? 0) - (rowsPerSymbol.get(a) ?? 0) || a.length - b.length || a.localeCompare(b)
    )[0]
    const mergedSymbols = candidates.filter(candidate => candidate !== symbol).sort()
    mergedSymbols.forEach(merged => renames.set(merged, symbol))
    merges.push({ isin, symbol, mergedSymbols })
  }

  if (renames.size === 0 && splitSymbols.size === 0) {
    return { transactions, merges, conflicts }
  }

  const matched = transactions.map(tx => {
    if (tx.isin && splitSymbols.has(tx.symbol)) {
      return { ...tx, symbol: `${tx.symbol} (${tx.isin})` }
    }
    const renamed = renames.get(tx.symbol)
    return renamed ? { ...tx, symbol: renamed } : tx
  })

  return { transactions: matched, merges, conflicts }
}
