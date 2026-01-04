import { EnrichedTransaction } from '../../types/transaction'
import { MatchingResult } from '../../types/cgt'
import { getEffectiveQuantity, getEffectivePrice, isAcquisition, isDisposal } from './utils'

/**
 * Short Sell Matching Rule
 *
 * Short selling is when you sell shares you don't own, betting the price will fall.
 * You later buy shares to "cover" the short position.
 *
 * This matcher identifies short sells using the explicit `is_short_sell` flag
 * set by broker parsers (e.g., Schwab "Sell Short" action).
 *
 * Key points:
 * - Only transactions with `is_short_sell: true` are treated as short sells
 * - Short positions are matched against subsequent BUYs using FIFO
 * - The SELL is the disposal, the covering BUY is the acquisition
 * - Gain = SELL proceeds - BUY cost (profit if sold high, bought low)
 *
 * This rule runs BEFORE same-day, 30-day, and Section 104 rules.
 */

/**
 * Represents an open short position waiting to be covered
 */
interface ShortPosition {
  /** The original SELL transaction that opened the short */
  transaction: EnrichedTransaction
  /** Remaining quantity that hasn't been covered yet */
  remainingQuantity: number
}

/**
 * Apply short sell matching rule to transactions
 *
 * Identifies short sells using the explicit `is_short_sell` flag and matches
 * them against subsequent BUY transactions to cover the position.
 *
 * @param transactions All enriched transactions
 * @returns Array of matching results for short sell matches
 */
export function applyShortSellRule(
  transactions: EnrichedTransaction[]
): MatchingResult[] {
  const matchings: MatchingResult[] = []

  // Group by symbol
  const bySymbol = groupBySymbol(transactions)

  for (const symbolTransactions of bySymbol.values()) {
    // Sort chronologically, with short sells (disposals) before acquisitions on same day
    // This ensures short positions are opened before they can be covered
    const sorted = symbolTransactions.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      
      // On same day: short sells first, then other disposals, then acquisitions
      const aIsShortSell = isDisposal(a) && a.is_short_sell
      const bIsShortSell = isDisposal(b) && b.is_short_sell
      if (aIsShortSell && !bIsShortSell) return -1
      if (!aIsShortSell && bIsShortSell) return 1
      
      return 0
    })

    // Queue of open short positions (FIFO)
    const shortPositions: ShortPosition[] = []

    // Process each transaction in chronological order
    for (const tx of sorted) {
      const quantity = getEffectiveQuantity(tx)
      if (quantity <= 0) continue

      if (isDisposal(tx) && tx.is_short_sell) {
        // This is an explicit short sell - add to short positions queue
        shortPositions.push({
          transaction: tx,
          remainingQuantity: quantity,
        })
      } else if (isAcquisition(tx) && shortPositions.length > 0) {
        // BUY can cover open short positions
        let remainingBuyQuantity = quantity

        while (shortPositions.length > 0 && remainingBuyQuantity > 0) {
          const oldestShort = shortPositions[0]
          const quantityToMatch = Math.min(remainingBuyQuantity, oldestShort.remainingQuantity)

          // Create matching result: SELL (disposal) matched with BUY (acquisition)
          const matching = createShortSellMatching(
            oldestShort.transaction,
            tx,
            quantityToMatch
          )
          matchings.push(matching)

          // Update quantities
          remainingBuyQuantity -= quantityToMatch
          oldestShort.remainingQuantity -= quantityToMatch

          // Remove fully covered short positions
          if (oldestShort.remainingQuantity <= 0) {
            shortPositions.shift()
          }
        }
      }
    }
  }

  return matchings
}

/**
 * Create a matching result for a short sell
 *
 * @param disposal The SELL transaction (opening the short)
 * @param acquisition The BUY transaction (covering the short)
 * @param quantity The quantity matched
 */
function createShortSellMatching(
  disposal: EnrichedTransaction,
  acquisition: EnrichedTransaction,
  quantity: number
): MatchingResult {
  // Calculate cost basis for the covering BUY
  // For options, prices are quoted per-share but quantities are in contracts,
  // so we need to multiply by contract_size (typically 100)
  const buyPricePerShare = getEffectivePrice(acquisition)
  const buyEffectiveQuantity = getEffectiveQuantity(acquisition)
  const contractMultiplier = acquisition.contract_size || 1
  const buyFeePerShare = acquisition.fee_gbp
    ? acquisition.fee_gbp / Math.max(buyEffectiveQuantity * contractMultiplier, 1)
    : 0
  const costBasisPerShare = buyPricePerShare + buyFeePerShare
  const costBasisGbp = costBasisPerShare * quantity * contractMultiplier

  return {
    disposal,
    acquisitions: [
      {
        transaction: acquisition,
        quantityMatched: quantity,
        costBasisGbp,
      },
    ],
    rule: 'SHORT_SELL',
    quantityMatched: quantity,
    totalCostBasisGbp: costBasisGbp,
  }
}

/**
 * Mark transactions as matched under short sell rule
 */
export function markShortSellMatches(
  transactions: EnrichedTransaction[],
  matchings: MatchingResult[]
): EnrichedTransaction[] {
  const matchedTxIds = new Set<string>()

  // Collect all transaction IDs involved in short sell matches
  for (const matching of matchings) {
    matchedTxIds.add(matching.disposal.id)
    for (const acq of matching.acquisitions) {
      matchedTxIds.add(acq.transaction.id)
    }
  }

  // Update gain_group for matched transactions
  return transactions.map(tx => {
    if (matchedTxIds.has(tx.id)) {
      return { ...tx, gain_group: 'SHORT_SELL' }
    }
    return tx
  })
}

/**
 * Get remaining unmatched quantity for a transaction after short sell matching
 */
export function getRemainingQuantity(
  transaction: EnrichedTransaction,
  matchings: MatchingResult[]
): number {
  const originalQuantity = getEffectiveQuantity(transaction)

  // Sum up all matched quantities for this transaction
  let matchedQuantity = 0

  for (const matching of matchings) {
    // Check if this transaction is the disposal
    if (matching.disposal.id === transaction.id) {
      matchedQuantity += matching.quantityMatched
    }

    // Check if this transaction is an acquisition
    for (const acq of matching.acquisitions) {
      if (acq.transaction.id === transaction.id) {
        matchedQuantity += acq.quantityMatched
      }
    }
  }

  return Math.max(0, originalQuantity - matchedQuantity)
}

/**
 * Group transactions by symbol
 */
function groupBySymbol(
  transactions: EnrichedTransaction[]
): Map<string, EnrichedTransaction[]> {
  const groups = new Map<string, EnrichedTransaction[]>()

  for (const tx of transactions) {
    if (!groups.has(tx.symbol)) {
      groups.set(tx.symbol, [])
    }
    groups.get(tx.symbol)!.push(tx)
  }

  return groups
}
