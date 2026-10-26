import { EnrichedTransaction } from '../../types/transaction'
import { MatchingResult } from '../../types/cgt'
import { MatchingStage } from './pipeline'
import {
  isAcquisition,
  isDisposal,
  groupBySymbol,
  MatchedQuantityTracker,
  calculateCostBasis,
  allocateProRata,
} from './utils'

/**
 * Same-Day Matching Rule (TCGA92/S105(1))
 *
 * "Shares acquired and sold on the same day"
 *
 * When shares of the same class are both bought and sold on the same day,
 * the acquisitions on that day are matched against the disposals on that day
 * for CGT purposes, regardless of the actual order of transactions.
 *
 * HMRC Reference: CG51560 (TCGA92/S105(1))
 * https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560
 */

/**
 * Apply same-day matching rule to a set of transactions
 *
 * @param transactions All enriched transactions (must include BUY and SELL types)
 * @param priorMatchings Previously applied matchings (e.g., from short sell rule)
 * @returns Array of matching results for same-day matches
 */
export function applySameDayRule(
  transactions: EnrichedTransaction[],
  priorMatchings: MatchingResult[] = []
): MatchingResult[] {
  const matchings: MatchingResult[] = []

  // O(1) remaining-quantity lookups against prior-rule matchings
  const tracker = new MatchedQuantityTracker(priorMatchings)

  // Group transactions by symbol
  const bySymbol = groupBySymbol(transactions)

  // Process each symbol independently
  for (const symbolTransactions of bySymbol.values()) {
    // Group by date
    const byDate = groupByDate(symbolTransactions)

    // For each date, match buys and sells
    for (const dateTransactions of byDate.values()) {
      const buys = dateTransactions.filter(tx => isAcquisition(tx))
      const sells = dateTransactions.filter(tx => isDisposal(tx))

      if (buys.length === 0 || sells.length === 0) {
        continue // No same-day matches possible
      }

      // Match sells against buys on the same day, respecting prior matchings
      const dayMatchings = matchSameDayTransactions(sells, buys, tracker)
      matchings.push(...dayMatchings)
    }
  }

  return matchings
}

/**
 * Match sells against buys on the same day for a single symbol
 *
 * Per TCGA92/S105(1) the day's acquisitions are one acquisition and the day's
 * disposals are one disposal. So when quantities differ, every buy and every
 * sell is matched pro rata (not first-in first-out): each sell gets the day's
 * average cost, and any unmatched buys carry the day's average cost into the
 * 30-day and Section 104 rules.
 */
function matchSameDayTransactions(
  sells: EnrichedTransaction[],
  buys: EnrichedTransaction[],
  tracker: MatchedQuantityTracker
): MatchingResult[] {
  // Quantities still available after prior rules (e.g. short sells)
  const openSells = sells
    .map(transaction => ({ transaction, available: tracker.getRemaining(transaction) }))
    .filter(item => item.available > 0)
  const openBuys = buys
    .map(transaction => ({ transaction, available: tracker.getRemaining(transaction) }))
    .filter(item => item.available > 0)

  const totalSell = openSells.reduce((sum, item) => sum + item.available, 0)
  const totalBuy = openBuys.reduce((sum, item) => sum + item.available, 0)
  const totalMatched = Math.min(totalSell, totalBuy)

  if (totalMatched <= 0) {
    return [] // Everything already matched by prior rules
  }

  const sellAllocations = allocateProRata(openSells, totalMatched)
  const buyAllocations = allocateProRata(openBuys, totalMatched)

  // Each sell draws the same fraction from every buy; the last sell takes
  // what is left of each buy so the buy totals stay exact
  const buyRemaining = buyAllocations.map(allocation => allocation.quantity)

  return sellAllocations.map(({ transaction: sell, quantity: sellQuantity }, sellIndex): MatchingResult => {
    const isLastSell = sellIndex === sellAllocations.length - 1
    const acquisitions: MatchingResult['acquisitions'] = []

    buyAllocations.forEach(({ transaction: buy, quantity: buyQuantity }, buyIndex) => {
      const quantityMatched = isLastSell
        ? buyRemaining[buyIndex]
        : (buyQuantity * sellQuantity) / totalMatched
      buyRemaining[buyIndex] -= quantityMatched
      if (quantityMatched <= 0) return

      acquisitions.push({
        transaction: buy,
        quantityMatched,
        costBasisGbp: calculateCostBasis(buy, quantityMatched),
      })
    })

    return {
      disposal: sell,
      acquisitions,
      rule: 'SAME_DAY',
      quantityMatched: sellQuantity,
      totalCostBasisGbp: acquisitions.reduce((sum, acq) => sum + acq.costBasisGbp, 0),
    }
  })
}

/**
 * Group transactions by date
 */
function groupByDate(
  transactions: EnrichedTransaction[]
): Map<string, EnrichedTransaction[]> {
  const groups = new Map<string, EnrichedTransaction[]>()

  for (const tx of transactions) {
    if (!groups.has(tx.date)) {
      groups.set(tx.date, [])
    }
    groups.get(tx.date)!.push(tx)
  }

  return groups
}


/**
 * Same-Day Rule Pipeline Stage (TCGA92/S105(1))
 *
 * Matches acquisitions and disposals on the same calendar day
 */
export const sameDayStage: MatchingStage = {
  name: 'same-day',
  apply(context) {
    const matchings = applySameDayRule(context.transactions, context.matchings)
    return {
      ...context,
      matchings: [...context.matchings, ...matchings],
    }
  },
}
