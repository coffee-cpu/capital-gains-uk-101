import { EnrichedTransaction, TransactionType } from '../../types/transaction'
import { MatchingResult } from '../../types/cgt'
import { getEffectiveQuantity, getEffectivePrice } from './utils'

/**
 * 30-Day "Bed and Breakfast" Rule (TCGA92/S106A(5) and (5A))
 *
 * "Shares repurchased within 30 days"
 *
 * If you sell shares and buy the same shares within 30 days after the sale,
 * the sale is matched against the repurchase for CGT purposes. This prevents
 * the "bed and breakfast" tax avoidance scheme where investors would sell shares
 * to crystallize a loss and immediately repurchase them.
 *
 * Key points:
 * - The 30-day period starts the day AFTER the disposal
 * - Matches are made in chronological order (FIFO) within the 30-day window
 * - Only unmatched quantities (after same-day rule) are eligible
 *
 * HMRC Reference: CG51560 (TCGA92/S106A(5) and (5A))
 * https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560
 */

/**
 * Apply 30-day matching rule to transactions
 *
 * @param transactions All enriched transactions
 * @param sameDayMatchings Previously applied same-day matchings
 * @returns Array of matching results for 30-day matches
 */
export function applyThirtyDayRule(
  transactions: EnrichedTransaction[],
  sameDayMatchings: MatchingResult[]
): MatchingResult[] {
  const matchings: MatchingResult[] = []

  // Group by symbol
  const bySymbol = groupBySymbol(transactions)

  for (const symbolTransactions of bySymbol.values()) {
    // Sort by date chronologically
    const sorted = symbolTransactions.sort((a, b) => a.date.localeCompare(b.date))

    // Get sells with remaining unmatched quantities
    const sells = sorted.filter(tx => tx.type === TransactionType.SELL)

    for (const sell of sells) {
      // Combine same-day + existing 30-day matchings for accurate remaining quantity
      const allMatchings = [...sameDayMatchings, ...matchings]
      const remainingSellQuantity = getRemainingQuantity(sell, allMatchings)
      if (remainingSellQuantity <= 0) {
        continue
      }

      // Find buys within 30 days AFTER this sell
      const matchingBuys = findBuysWithin30Days(sell, sorted, allMatchings)

      if (matchingBuys.length === 0) {
        continue
      }

      // Match the sell against the buys
      const matching = matchSellAgainstBuys(sell, matchingBuys, remainingSellQuantity, allMatchings)
      if (matching) {
        matchings.push(matching)
      }
    }
  }

  return matchings
}

/**
 * Find buy transactions within 30 days after a sell
 */
function findBuysWithin30Days(
  sell: EnrichedTransaction,
  sortedTransactions: EnrichedTransaction[],
  existingMatchings: MatchingResult[]
): EnrichedTransaction[] {
  const sellDate = new Date(sell.date)
  const thirtyDaysLater = new Date(sellDate)
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)

  const matchingBuys: EnrichedTransaction[] = []

  for (const tx of sortedTransactions) {
    if (tx.type !== TransactionType.BUY) {
      continue
    }

    const txDate = new Date(tx.date)

    // Must be after the sell date (not including the sell date itself)
    if (txDate <= sellDate) {
      continue
    }

    // Must be within 30 days
    if (txDate > thirtyDaysLater) {
      break // Since transactions are sorted, we can stop here
    }

    // Must have remaining unmatched quantity
    const remaining = getRemainingQuantity(tx, existingMatchings)
    if (remaining > 0) {
      matchingBuys.push(tx)
    }
  }

  return matchingBuys
}

/**
 * Match a sell against available buys within 30-day window
 */
function matchSellAgainstBuys(
  sell: EnrichedTransaction,
  buys: EnrichedTransaction[],
  sellQuantity: number,
  existingMatchings: MatchingResult[]
): MatchingResult | null {
  let remainingSellQuantity = sellQuantity
  const acquisitions: MatchingResult['acquisitions'] = []

  // Match against buys in chronological order (FIFO)
  for (const buy of buys) {
    if (remainingSellQuantity <= 0) {
      break
    }

    const availableBuyQuantity = getRemainingQuantity(buy, existingMatchings)
    if (availableBuyQuantity <= 0) {
      continue
    }

    // Match as much as possible from this buy
    const quantityToMatch = Math.min(remainingSellQuantity, availableBuyQuantity)

    // Calculate cost basis for the matched portion (use split-adjusted price if available)
    const pricePerShare = getEffectivePrice(buy)
    const buyEffectiveQuantity = getEffectiveQuantity(buy)
    const feePerShare = buy.fee_gbp ? buy.fee_gbp / Math.max(buyEffectiveQuantity, 1) : 0
    const costBasisPerShare = pricePerShare + feePerShare
    const costBasisGbp = costBasisPerShare * quantityToMatch

    acquisitions.push({
      transaction: buy,
      quantityMatched: quantityToMatch,
      costBasisGbp,
    })

    remainingSellQuantity -= quantityToMatch
  }

  // Return matching result if we matched any quantity
  if (acquisitions.length > 0) {
    const quantityMatched = acquisitions.reduce((sum, acq) => sum + acq.quantityMatched, 0)
    const totalCostBasisGbp = acquisitions.reduce((sum, acq) => sum + acq.costBasisGbp, 0)

    return {
      disposal: sell,
      acquisitions,
      rule: '30_DAY',
      quantityMatched,
      totalCostBasisGbp,
    }
  }

  return null
}

/**
 * Mark transactions as matched under 30-day rule
 */
export function markThirtyDayMatches(
  transactions: EnrichedTransaction[],
  matchings: MatchingResult[]
): EnrichedTransaction[] {
  const matchedTxIds = new Set<string>()

  // Collect all transaction IDs involved in 30-day matches
  for (const matching of matchings) {
    // Only mark if not already marked as SAME_DAY
    if (matching.disposal.gain_group !== 'SAME_DAY') {
      matchedTxIds.add(matching.disposal.id)
    }
    for (const acq of matching.acquisitions) {
      if (acq.transaction.gain_group !== 'SAME_DAY') {
        matchedTxIds.add(acq.transaction.id)
      }
    }
  }

  // Update gain_group for matched transactions
  return transactions.map(tx => {
    if (matchedTxIds.has(tx.id) && tx.gain_group !== 'SAME_DAY') {
      return { ...tx, gain_group: '30_DAY' }
    }
    return tx
  })
}

/**
 * Get remaining unmatched quantity for a transaction
 */
function getRemainingQuantity(
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
