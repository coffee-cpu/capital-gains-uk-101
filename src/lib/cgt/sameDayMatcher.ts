import { EnrichedTransaction, TransactionType } from '../../types/transaction'
import { MatchingResult } from '../../types/cgt'

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
 * @returns Array of matching results for same-day matches
 */
export function applySameDayRule(
  transactions: EnrichedTransaction[]
): MatchingResult[] {
  const matchings: MatchingResult[] = []

  // Group transactions by symbol
  const bySymbol = groupBySymbol(transactions)

  // Process each symbol independently
  for (const symbolTransactions of bySymbol.values()) {
    // Group by date
    const byDate = groupByDate(symbolTransactions)

    // For each date, match buys and sells
    for (const dateTransactions of byDate.values()) {
      const buys = dateTransactions.filter(tx => tx.type === TransactionType.BUY)
      const sells = dateTransactions.filter(tx => tx.type === TransactionType.SELL)

      if (buys.length === 0 || sells.length === 0) {
        continue // No same-day matches possible
      }

      // Match sells against buys on the same day
      const dayMatchings = matchSameDayTransactions(sells, buys)
      matchings.push(...dayMatchings)
    }
  }

  return matchings
}

/**
 * Match sells against buys on the same day for a single symbol
 */
function matchSameDayTransactions(
  sells: EnrichedTransaction[],
  buys: EnrichedTransaction[]
): MatchingResult[] {
  const matchings: MatchingResult[] = []

  // Track remaining quantities for each buy
  const buyQuantities = new Map<string, number>()
  buys.forEach(buy => {
    if (buy.quantity !== null && buy.quantity > 0) {
      buyQuantities.set(buy.id, buy.quantity)
    }
  })

  // Process each sell
  for (const sell of sells) {
    if (sell.quantity === null || sell.quantity <= 0) {
      continue
    }

    let remainingSellQuantity = sell.quantity
    const acquisitions: MatchingResult['acquisitions'] = []

    // Match against available buys (FIFO order within the day)
    for (const buy of buys) {
      if (remainingSellQuantity <= 0) {
        break
      }

      const availableBuyQuantity = buyQuantities.get(buy.id) || 0
      if (availableBuyQuantity <= 0) {
        continue
      }

      // Match as much as possible from this buy
      const quantityToMatch = Math.min(remainingSellQuantity, availableBuyQuantity)

      // Calculate cost basis for the matched portion
      const pricePerShare = buy.price_gbp || 0
      const feePerShare = buy.fee_gbp ? buy.fee_gbp / (buy.quantity || 1) : 0
      const costBasisPerShare = pricePerShare + feePerShare
      const costBasisGbp = costBasisPerShare * quantityToMatch

      acquisitions.push({
        transaction: buy,
        quantityMatched: quantityToMatch,
        costBasisGbp,
      })

      // Update remaining quantities
      remainingSellQuantity -= quantityToMatch
      buyQuantities.set(buy.id, availableBuyQuantity - quantityToMatch)
    }

    // If we matched any quantity, create a matching result
    if (acquisitions.length > 0) {
      const quantityMatched = acquisitions.reduce((sum, acq) => sum + acq.quantityMatched, 0)
      const totalCostBasisGbp = acquisitions.reduce((sum, acq) => sum + acq.costBasisGbp, 0)

      matchings.push({
        disposal: sell,
        acquisitions,
        rule: 'SAME_DAY',
        quantityMatched,
        totalCostBasisGbp,
      })
    }
  }

  return matchings
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
 * Mark transactions as matched under same-day rule
 *
 * Updates the gain_group field on transactions that were matched
 */
export function markSameDayMatches(
  transactions: EnrichedTransaction[],
  matchings: MatchingResult[]
): EnrichedTransaction[] {
  const matchedTxIds = new Set<string>()

  // Collect all transaction IDs involved in same-day matches
  for (const matching of matchings) {
    matchedTxIds.add(matching.disposal.id)
    for (const acq of matching.acquisitions) {
      matchedTxIds.add(acq.transaction.id)
    }
  }

  // Update gain_group for matched transactions
  return transactions.map(tx => {
    if (matchedTxIds.has(tx.id)) {
      return { ...tx, gain_group: 'SAME_DAY' }
    }
    return tx
  })
}

/**
 * Get remaining unmatched quantity for a transaction after same-day matching
 *
 * This is used by subsequent matching rules (30-day, Section 104)
 */
export function getRemainingQuantity(
  transaction: EnrichedTransaction,
  matchings: MatchingResult[]
): number {
  const originalQuantity = transaction.quantity || 0

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
