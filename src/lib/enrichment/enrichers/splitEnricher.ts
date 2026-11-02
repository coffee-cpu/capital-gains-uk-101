import { EnrichedTransaction, StockSplitEvent, parseRatioMultiplier } from '../../../types/transaction'
import { Enricher } from '../types'

/**
 * Extract stock split events from transactions
 * Converts STOCK_SPLIT transactions into StockSplitEvent records
 */
export function extractStockSplits(transactions: EnrichedTransaction[]): StockSplitEvent[] {
  const splits: StockSplitEvent[] = []

  for (const tx of transactions) {
    if (tx.type === 'STOCK_SPLIT' && tx.ratio) {
      try {
        const ratioMultiplier = parseRatioMultiplier(tx.ratio)

        splits.push({
          id: tx.id,
          date: tx.date,
          symbol: tx.symbol,
          ratio: tx.ratio,
          ratioMultiplier,
          source: tx.source,
          originalTransaction: tx,
        })
      } catch (error) {
        // Invalid ratio format - skip this split
        console.warn(`Skipping invalid stock split ratio for ${tx.symbol} on ${tx.date}: ${tx.ratio}`)
      }
    }
  }

  // Sort by date (earliest first) to apply in chronological order
  splits.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return dedupeSplitEvents(splits)
}

/**
 * Brokers may record the same split a few days apart (ex-date vs pay date),
 * matching the window used to dedupe auto-fetched splits.
 */
const SPLIT_DEDUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Collapse repeated reports of the same split into one event.
 *
 * The same split often arrives more than once: from two brokers that both
 * held the shares, or from overlapping exports of one broker. Applying each
 * copy would multiply quantities by the ratio twice (10 shares becoming 1,000
 * after a 10:1 split), so events for the same symbol within a few days of
 * each other are treated as one split, keeping the earliest.
 *
 * @param splits Split events sorted by date (earliest first)
 */
function dedupeSplitEvents(splits: StockSplitEvent[]): StockSplitEvent[] {
  const kept: StockSplitEvent[] = []

  for (const split of splits) {
    const splitMs = new Date(split.date).getTime()
    const duplicateOf = kept.find(existing =>
      existing.symbol === split.symbol &&
      Math.abs(new Date(existing.date).getTime() - splitMs) <= SPLIT_DEDUP_WINDOW_MS
    )

    if (!duplicateOf) {
      kept.push(split)
      continue
    }

    if (duplicateOf.ratioMultiplier !== split.ratioMultiplier) {
      console.warn(
        `Conflicting stock split records for ${split.symbol}: ${duplicateOf.ratio} on ${duplicateOf.date} ` +
        `(${duplicateOf.source}) and ${split.ratio} on ${split.date} (${split.source}). Using ${duplicateOf.ratio}.`
      )
    }
  }

  return kept
}

/**
 * Split Enricher
 *
 * Applies stock split adjustments per HMRC TCGA92/S127:
 * - Share reorganisations (including splits) do not create a disposal
 * - The new shares take on the acquisition date of the original shares
 * - Cost basis is preserved (quantity increases, price per share decreases proportionally)
 *
 * Forward normalization strategy:
 * - All quantities are normalized to the most recent split-adjusted units
 * - For a transaction before a 10:1 split, multiply quantity by 10, divide price by 10
 * - This ensures all quantities are comparable for CGT matching
 *
 * Populates fields:
 * - split_adjusted_quantity
 * - split_adjusted_price
 * - split_multiplier
 * - applied_splits
 */
export class SplitEnricher implements Enricher {
  name = 'SplitEnricher'

  async enrich(transactions: EnrichedTransaction[]): Promise<EnrichedTransaction[]> {
    // Extract all stock split events
    const allSplits = extractStockSplits(transactions)

    // Group splits by symbol
    const splitsBySymbol = new Map<string, StockSplitEvent[]>()
    for (const split of allSplits) {
      const existing = splitsBySymbol.get(split.symbol) || []
      existing.push(split)
      splitsBySymbol.set(split.symbol, existing)
    }

    // Process each transaction
    return transactions.map((tx) => {
      // STOCK_SPLIT transactions themselves don't need normalization
      if (tx.type === 'STOCK_SPLIT') {
        return {
          ...tx,
          split_adjusted_quantity: null,
          split_adjusted_price: null,
          split_multiplier: 1.0,
          applied_splits: [],
        }
      }

      // Only BUY and SELL transactions have quantities/prices to adjust
      if (tx.type !== 'BUY' && tx.type !== 'SELL') {
        return {
          ...tx,
          split_adjusted_quantity: null,
          split_adjusted_price: null,
          split_multiplier: 1.0,
          applied_splits: [],
        }
      }

      // Get splits for this symbol
      const splits = splitsBySymbol.get(tx.symbol) || []

      // Find splits that occurred AFTER this transaction
      // (we need to normalize to the most recent units)
      const futureSplits = splits.filter(
        (split) => new Date(split.date).getTime() > new Date(tx.date).getTime()
      )

      // If no future splits, no adjustment needed
      if (futureSplits.length === 0) {
        return {
          ...tx,
          split_adjusted_quantity: tx.quantity,
          split_adjusted_price: tx.price,
          split_multiplier: 1.0,
          applied_splits: [],
        }
      }

      // Calculate cumulative multiplier (multiply all split ratios together)
      const cumulativeMultiplier = futureSplits.reduce(
        (mult, split) => mult * split.ratioMultiplier,
        1.0
      )

      // Apply normalization
      const adjustedQuantity = tx.quantity !== null ? tx.quantity * cumulativeMultiplier : null
      const adjustedPrice = tx.price !== null ? tx.price / cumulativeMultiplier : null

      return {
        ...tx,
        split_adjusted_quantity: adjustedQuantity,
        split_adjusted_price: adjustedPrice,
        split_multiplier: cumulativeMultiplier,
        applied_splits: futureSplits.map((s) => s.id),
      }
    })
  }
}
