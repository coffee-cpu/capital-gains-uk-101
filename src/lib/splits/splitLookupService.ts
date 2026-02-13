import { GenericTransaction } from '../../types/transaction'
import { SplitDataSource, SplitRecord, JsDelivrSplitSource } from './splitDataSource'

/** Transaction types that indicate the user holds a given symbol */
const HOLDING_TYPES = new Set(['BUY', 'SELL', 'OPTIONS_BUY_TO_OPEN', 'OPTIONS_SELL_TO_OPEN', 'OPTIONS_BUY_TO_CLOSE', 'OPTIONS_SELL_TO_CLOSE', 'OPTIONS_ASSIGNED'])

/**
 * Fetches auto-detected stock splits for the user's held symbols,
 * deduplicates against broker-provided STOCK_SPLIT records, and
 * returns synthetic GenericTransaction STOCK_SPLIT records.
 *
 * Auto-fetched splits are NOT persisted — they're regenerated each run
 * from cached source data.
 *
 * @param transactions - All current transactions (after deduplication)
 * @param dataSource - Injectable data source (defaults to jsDelivr CDN)
 * @returns Synthetic STOCK_SPLIT GenericTransaction records to inject into the pipeline
 */
export async function getAutoSplitsForTransactions(
  transactions: GenericTransaction[],
  dataSource?: SplitDataSource
): Promise<GenericTransaction[]> {
  try {
    const source = dataSource ?? new JsDelivrSplitSource()

    // Extract unique symbols from BUY/SELL transactions
    const symbols = new Set<string>()
    for (const tx of transactions) {
      if (HOLDING_TYPES.has(tx.type) && tx.symbol) {
        symbols.add(tx.symbol)
      }
    }

    if (symbols.size === 0) {
      return []
    }

    // Derive year range from transaction dates
    const years = getYearRange(transactions)
    if (years.length === 0) {
      return []
    }

    // Fetch splits from data source
    const allSplits = await source.fetchSplitsForYears(years)

    // Filter to only symbols the user holds
    const relevantSplits = allSplits.filter(s => symbols.has(s.symbol))

    // Build list of existing broker-provided splits for deduplication
    // Uses fuzzy date matching (±7 days) because brokers may record split dates
    // slightly differently than CDN sources (e.g., ex-date vs effective date)
    const brokerSplits: Array<{ symbol: string; dateMs: number; ratio?: string | null }> = []
    for (const tx of transactions) {
      if (tx.type === 'STOCK_SPLIT' && tx.symbol && tx.date) {
        brokerSplits.push({ symbol: tx.symbol, dateMs: new Date(tx.date).getTime(), ratio: tx.ratio })
      }
    }

    // Deduplicate: broker-provided splits take priority (fuzzy ±7 day match)
    // When both dates and ratios match, it's definitely a duplicate.
    // When dates match but ratios differ, still dedupe (broker data wins).
    const DEDUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
    const newSplits = relevantSplits.filter(s => {
      const cdnDateMs = new Date(s.date).getTime()
      const cdnRatio = `${s.ratioTo}:${s.ratioFrom}`
      return !brokerSplits.some(b => {
        if (b.symbol !== s.symbol) return false
        const withinWindow = Math.abs(b.dateMs - cdnDateMs) <= DEDUP_WINDOW_MS
        if (!withinWindow) return false
        if (b.ratio && b.ratio !== cdnRatio) {
          console.debug(`Auto-splits: skipping CDN split ${s.symbol} ${s.date} (${cdnRatio}) — broker has ${b.ratio} within ±7 days`)
        }
        return true
      })
    })

    // Convert to synthetic GenericTransaction records
    return newSplits.map(split => splitRecordToTransaction(split))
  } catch {
    // Graceful degradation — return empty on any failure
    return []
  }
}

/**
 * Derive the year range to query from transaction dates.
 * Returns all years from the earliest transaction year to the current year.
 */
function getYearRange(transactions: GenericTransaction[]): number[] {
  let minYear = Infinity
  let maxYear = -Infinity

  for (const tx of transactions) {
    if (!tx.date) continue
    const year = new Date(tx.date).getFullYear()
    if (year < minYear) minYear = year
    if (year > maxYear) maxYear = year
  }

  if (!isFinite(minYear) || !isFinite(maxYear)) {
    return []
  }

  // Extend to current year (splits may have happened after last transaction)
  const currentYear = new Date().getFullYear()
  maxYear = Math.max(maxYear, currentYear)

  // Cap range to prevent runaway requests from malformed dates
  const MAX_YEAR_SPAN = 50
  if (maxYear - minYear > MAX_YEAR_SPAN) {
    minYear = maxYear - MAX_YEAR_SPAN
  }

  const years: number[] = []
  for (let y = minYear; y <= maxYear; y++) {
    years.push(y)
  }
  return years
}

/**
 * Convert a SplitRecord to a synthetic GenericTransaction.
 */
function splitRecordToTransaction(split: SplitRecord): GenericTransaction {
  return {
    id: `auto-split-${split.symbol}-${split.date}`,
    source: 'Community',
    symbol: split.symbol,
    name: split.name ?? null,
    date: split.date,
    type: 'STOCK_SPLIT',
    quantity: null,
    price: null,
    currency: 'GBP',
    total: null,
    fee: null,
    notes: split.notes ?? null,
    ratio: `${split.ratioTo}:${split.ratioFrom}`,
  }
}
