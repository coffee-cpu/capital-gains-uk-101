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
  addDaysToISODate,
  QUANTITY_EPSILON,
} from './utils'

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

  // Tracks quantities consumed by prior rules and by 30-day matchings as
  // they are created, so remaining-quantity lookups are O(1)
  const tracker = new MatchedQuantityTracker(sameDayMatchings)

  // Group by symbol
  const bySymbol = groupBySymbol(transactions)

  for (const symbolTransactions of bySymbol.values()) {
    // Sort by date chronologically
    const sorted = symbolTransactions.sort((a, b) => a.date.localeCompare(b.date))

    // Get sells with remaining unmatched quantities
    const sells = sorted.filter(tx => isDisposal(tx))

    for (const sell of sells) {
      const remainingSellQuantity = tracker.getRemaining(sell)
      if (remainingSellQuantity <= 0) {
        continue
      }

      // Find buys within 30 days AFTER this sell
      const matchingBuys = findBuysWithin30Days(sell, sorted, tracker)

      if (matchingBuys.length === 0) {
        continue
      }

      // Match the sell against the buys
      const matching = matchSellAgainstBuys(sell, matchingBuys, remainingSellQuantity, tracker)
      if (matching) {
        matchings.push(matching)
        tracker.add(matching)
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
  tracker: MatchedQuantityTracker
): EnrichedTransaction[] {
  // ISO dates compare correctly as strings; avoid Date objects so the
  // window doesn't shift across a DST change in the user's timezone
  const lastEligibleDate = addDaysToISODate(sell.date, 30)

  const matchingBuys: EnrichedTransaction[] = []

  for (const tx of sortedTransactions) {
    if (!isAcquisition(tx)) {
      continue
    }

    // Must be after the sell date (not including the sell date itself)
    if (tx.date <= sell.date) {
      continue
    }

    // Must be within 30 days
    if (tx.date > lastEligibleDate) {
      break // Since transactions are sorted, we can stop here
    }

    // Must have remaining unmatched quantity
    if (tracker.getRemaining(tx) > 0) {
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
  tracker: MatchedQuantityTracker
): MatchingResult | null {
  let remainingSellQuantity = sellQuantity
  const acquisitions: MatchingResult['acquisitions'] = []

  // Match against buys in chronological order (FIFO by day). Buys on the
  // same day are one acquisition (TCGA92/S105(1)), so a partial match draws
  // on them pro rata at the day's average cost. The split uses each buy's
  // remaining quantity, which equals the day's original mix unless an
  // earlier rule (e.g. a short-sell cover) consumed one buy on its own.
  for (const dayBuys of groupConsecutiveByDate(buys)) {
    if (remainingSellQuantity <= QUANTITY_EPSILON) {
      break
    }

    const available = dayBuys
      .map(transaction => ({ transaction, available: tracker.getRemaining(transaction) }))
      .filter(item => item.available > 0)
    const dayAvailable = available.reduce((sum, item) => sum + item.available, 0)
    if (dayAvailable <= QUANTITY_EPSILON) {
      continue
    }

    const quantityFromDay = Math.min(remainingSellQuantity, dayAvailable)

    for (const { transaction: buy, quantity } of allocateProRata(available, quantityFromDay)) {
      if (quantity <= QUANTITY_EPSILON) continue
      acquisitions.push({
        transaction: buy,
        quantityMatched: quantity,
        costBasisGbp: calculateCostBasis(buy, quantity),
      })
    }

    remainingSellQuantity -= quantityFromDay
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
 * Split date-sorted transactions into runs that share the same date
 */
function groupConsecutiveByDate(sorted: EnrichedTransaction[]): EnrichedTransaction[][] {
  const groups: EnrichedTransaction[][] = []
  for (const tx of sorted) {
    const current = groups[groups.length - 1]
    if (current && current[0].date === tx.date) {
      current.push(tx)
    } else {
      groups.push([tx])
    }
  }
  return groups
}

/**
 * 30-Day Rule Pipeline Stage (TCGA92/S106A(5))
 *
 * Matches disposals with acquisitions within 30 days (bed and breakfast)
 */
export const thirtyDayStage: MatchingStage = {
  name: 'thirty-day',
  apply(context) {
    const matchings = applyThirtyDayRule(context.transactions, context.matchings)
    return {
      ...context,
      matchings: [...context.matchings, ...matchings],
    }
  },
}

