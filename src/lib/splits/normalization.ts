import { GenericTransaction, EnrichedTransaction, StockSplitEvent, parseRatioMultiplier } from '../../types/transaction'

/**
 * Extract stock split events from transactions
 * Converts STOCK_SPLIT transactions into StockSplitEvent records
 */
export function extractStockSplits(transactions: GenericTransaction[]): StockSplitEvent[] {
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
  return splits.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/**
 * Apply stock split adjustments to transactions (first pass of enrichment)
 * Adjusts quantities and prices for all transactions that occurred before splits
 *
 * Per HMRC TCGA92/S127:
 * - Share reorganisations (including splits) do not create a disposal
 * - The new shares take on the acquisition date of the original shares
 * - Cost basis is preserved (quantity increases, price per share decreases proportionally)
 *
 * Forward normalization strategy:
 * - All quantities are normalized to the most recent split-adjusted units
 * - For a transaction before a 10:1 split, multiply quantity by 10, divide price by 10
 * - This ensures all quantities are comparable for CGT matching
 *
 * @param transactions Original transactions (including STOCK_SPLIT records)
 * @returns Partially enriched transactions with split fields populated, other enrichment fields as defaults
 */
export function applySplitNormalization(transactions: GenericTransaction[]): EnrichedTransaction[] {
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
  return transactions.map(tx => {
    // Common enrichment placeholder fields (will be populated in subsequent enrichment passes)
    const enrichmentDefaults = {
      fx_rate: null,
      price_gbp: null,
      value_gbp: null,
      fee_gbp: null,
      fx_source: '',
      fx_error: null,
      tax_year: '',
      gain_group: 'NONE' as const,
    }

    // STOCK_SPLIT transactions themselves don't need normalization
    if (tx.type === 'STOCK_SPLIT') {
      return {
        ...tx,
        ...enrichmentDefaults,
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
        ...enrichmentDefaults,
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
    const futureSplits = splits.filter(split =>
      new Date(split.date).getTime() > new Date(tx.date).getTime()
    )

    // If no future splits, no adjustment needed
    if (futureSplits.length === 0) {
      return {
        ...tx,
        ...enrichmentDefaults,
        split_adjusted_quantity: tx.quantity,
        split_adjusted_price: tx.price,
        split_multiplier: 1.0,
        applied_splits: [],
      }
    }

    // Calculate cumulative multiplier (multiply all split ratios together)
    const cumulativeMultiplier = futureSplits.reduce((mult, split) => mult * split.ratioMultiplier, 1.0)

    // Apply normalization
    const adjustedQuantity = tx.quantity !== null ? tx.quantity * cumulativeMultiplier : null
    const adjustedPrice = tx.price !== null ? tx.price / cumulativeMultiplier : null

    return {
      ...tx,
      ...enrichmentDefaults,
      split_adjusted_quantity: adjustedQuantity,
      split_adjusted_price: adjustedPrice,
      split_multiplier: cumulativeMultiplier,
      applied_splits: futureSplits.map(s => s.id),
    }
  })
}
