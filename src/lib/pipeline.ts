import { deduplicateTransactions, findOverlappingImports } from '../utils/deduplication'
import { findSplitConflicts } from './enrichment/enrichers/splitEnricher'
import { matchSymbolsByIsin } from './symbolMatching'
import { enrichTransactions } from './enrichment'
import { calculateCGT } from './cgt/engine'
import { getAutoSplitsForTransactions, hasUsableRatio, HOLDING_TYPES } from './splits/splitLookupService'
import { SplitDataSource, JsDelivrSplitSource } from './splits/splitDataSource'
import { FXSource, DEFAULT_FX_SOURCE } from '../types/fxSource'
import { CGTCalculationResult } from '../types/cgt'
import { GenericTransaction } from '../types/transaction'

export interface PipelineOptions {
  /** The FX source to use for currency conversion */
  fxSource?: FXSource
  /** Whether to auto-fetch stock splits from community data */
  autoSplits?: boolean
  /** Split data source override (defaults to the jsDelivr CDN) */
  splitSource?: SplitDataSource
}

/**
 * Run raw transactions through the full calculation pipeline:
 * 1. Deduplicate (rows repeated across overlapping imports, and incomplete
 *    Stock Plan Activity when Equity Awards exists)
 * 2. Inject auto-fetched stock splits (if enabled)
 * 3. Enrich with FX rates and GBP conversions
 * 4. Calculate CGT with HMRC matching rules
 *
 * Runtime-agnostic: shared by the web app (via `processTransactionsFromDB`)
 * and non-browser callers such as the CLI.
 *
 * @returns CGT calculation results (or null if no transactions)
 */
export async function runPipeline(
  rawTransactions: GenericTransaction[],
  options: PipelineOptions = {}
): Promise<CGTCalculationResult | null> {
  const { fxSource = DEFAULT_FX_SOURCE, autoSplits = true, splitSource } = options

  if (rawTransactions.length === 0) {
    return null
  }

  // Drop rows repeated across overlapping imports (kept for reporting), then
  // incomplete Stock Plan Activity when Equity Awards data exists
  const { kept, removed: overlappingRows } = findOverlappingImports(rawTransactions)

  const deduplicated = deduplicateTransactions(kept)

  // Inject auto-fetched stock splits (not persisted, regenerated each run).
  // Looked up under the brokers' own tickers, which is what split data uses,
  // before any renaming below.
  let withFetchedSplits = deduplicated
  const source = splitSource ?? new JsDelivrSplitSource()
  if (autoSplits) {
    const fetchedSplits = await getAutoSplitsForTransactions(deduplicated, source)
    if (fetchedSplits.length > 0) {
      withFetchedSplits = [...deduplicated, ...fetchedSplits]
    }
  }

  // One symbol per security across brokers (by ISIN). Fetched split rows
  // follow the same renames as the holdings they belong to.
  const {
    transactions: withAutoSplits,
    merges: symbolMerges,
    conflicts: tickerConflicts,
  } = matchSymbolsByIsin(withFetchedSplits)

  // Enrich with FX rates and GBP conversions using selected source
  const enriched = await enrichTransactions(withAutoSplits, fxSource)

  // Calculate CGT with HMRC matching rules
  const result = calculateCGT(enriched)

  // Report data choices that change the figures, so the UI and CLI can show them
  const rejectedSplitRecords = (source.rejectedRecords ?? [])
    .filter(r => mayBeMissedSplit(r, deduplicated))
    .map(({ symbol, date, reason }) => ({ symbol, date, reason }))
  result.dataNotices = {
    overlappingRows,
    splitConflicts: findSplitConflicts(withAutoSplits),
    rejectedSplitRecords,
    symbolMerges,
    tickerConflicts,
    splitsWithoutRatio: findSplitsWithoutRatio(withAutoSplits),
    autoSplits,
  }

  return result
}

/** Same window the split lookup uses to match broker and fetched splits */
const SPLIT_MATCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Whether a rejected fetched split could mean a missed split: the user holds
 * the share (same definition as the split lookup) and their own files don't
 * already record a usable split for it within a few days, which the lookup
 * would have preferred anyway.
 */
function mayBeMissedSplit(record: { symbol: string; date: string }, transactions: GenericTransaction[]): boolean {
  const held = transactions.some(tx => tx.symbol === record.symbol && HOLDING_TYPES.has(tx.type))
  if (!held) return false
  const recordMs = new Date(record.date).getTime()
  const coveredByBroker = transactions.some(tx =>
    tx.type === 'STOCK_SPLIT' &&
    tx.symbol === record.symbol &&
    hasUsableRatio(tx.ratio) &&
    Math.abs(new Date(tx.date).getTime() - recordMs) <= SPLIT_MATCH_WINDOW_MS
  )
  return !coveredByBroker
}

/**
 * Stock split rows with no usable ratio, for shares the user holds, that no
 * usable split record (the user's own, or fetched community data) covers
 * within the same window. The split enricher can't apply them, so without
 * this they would be skipped with no sign on screen. A share with no buys or
 * sells is left out: its split can't change any figure.
 */
export function findSplitsWithoutRatio(
  transactions: GenericTransaction[]
): { id: string; symbol: string; date: string; source: string }[] {
  const usable = transactions.filter(tx => tx.type === 'STOCK_SPLIT' && hasUsableRatio(tx.ratio))
  const held = new Set(transactions.filter(tx => HOLDING_TYPES.has(tx.type)).map(tx => tx.symbol))
  return transactions
    .filter(tx => tx.type === 'STOCK_SPLIT' && !hasUsableRatio(tx.ratio) && held.has(tx.symbol))
    .filter(tx => {
      const ms = new Date(tx.date).getTime()
      return !usable.some(split =>
        split.symbol === tx.symbol &&
        Math.abs(new Date(split.date).getTime() - ms) <= SPLIT_MATCH_WINDOW_MS
      )
    })
    .map(({ id, symbol, date, source }) => ({ id, symbol, date, source }))
}
