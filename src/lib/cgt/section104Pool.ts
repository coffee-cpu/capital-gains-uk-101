import { EnrichedTransaction, TransactionType } from '../../types/transaction'
import { Section104Pool, MatchingResult } from '../../types/cgt'
import { getEffectiveQuantity, getEffectivePrice } from './utils'

/**
 * Section 104 Pooled Holdings (HMRC CG51620)
 *
 * "Section 104 holding"
 *
 * After applying same-day and 30-day matching rules, any remaining shares
 * are placed in a "Section 104 pool". This pool maintains an average cost basis
 * for all shares of the same class.
 *
 * Key points:
 * - All acquisitions (after other rules) go into the pool at actual cost + fees
 * - All disposals (after other rules) are matched against the pool at average cost
 * - The pool maintains a running total of quantity and cost
 * - Average cost = Total Cost / Total Quantity
 *
 * Reference: https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51620
 */

/**
 * Apply Section 104 pooling to remaining unmatched transactions
 *
 * @param transactions All enriched transactions
 * @param existingMatchings Previously applied matchings (same-day + 30-day)
 * @returns Tuple of [new matchings for disposals, final pool states by symbol]
 */
export function applySection104Pooling(
  transactions: EnrichedTransaction[],
  existingMatchings: MatchingResult[]
): [MatchingResult[], Map<string, Section104Pool>] {
  const matchings: MatchingResult[] = []
  const pools = new Map<string, Section104Pool>()

  // Group by symbol
  const bySymbol = groupBySymbol(transactions)

  for (const [symbol, symbolTransactions] of bySymbol) {
    // Sort chronologically
    const sorted = symbolTransactions.sort((a, b) => a.date.localeCompare(b.date))

    // Initialize pool for this symbol
    const pool: Section104Pool = {
      symbol,
      quantity: 0,
      totalCostGbp: 0,
      averageCostGbp: 0,
      history: [],
    }

    // Process each transaction in chronological order
    for (const tx of sorted) {
      const remainingQuantity = getRemainingQuantity(tx, existingMatchings)

      if (remainingQuantity <= 0) {
        continue // Already fully matched by other rules
      }

      if (tx.type === TransactionType.BUY) {
        // Add to pool
        addToPool(pool, tx, remainingQuantity)
      } else if (tx.type === TransactionType.SELL) {
        // Match against pool
        const matching = matchAgainstPool(pool, tx, remainingQuantity)
        if (matching) {
          matchings.push(matching)
        }
      }
    }

    pools.set(symbol, pool)
  }

  return [matchings, pools]
}

/**
 * Add shares to the Section 104 pool
 */
function addToPool(
  pool: Section104Pool,
  transaction: EnrichedTransaction,
  quantity: number
): void {
  // Calculate cost including fees (use split-adjusted price if available)
  const pricePerShare = getEffectivePrice(transaction)
  const effectiveQuantity = getEffectiveQuantity(transaction)
  const feePerShare = transaction.fee_gbp ? transaction.fee_gbp / Math.max(effectiveQuantity, 1) : 0
  const costPerShare = pricePerShare + feePerShare
  const totalCost = costPerShare * quantity

  // Update pool
  pool.quantity += quantity
  pool.totalCostGbp += totalCost
  pool.averageCostGbp = pool.quantity > 0 ? pool.totalCostGbp / pool.quantity : 0

  // Record in history
  pool.history.push({
    date: transaction.date,
    type: 'BUY',
    quantity,
    costOrProceeds: totalCost,
    balanceQuantity: pool.quantity,
    balanceCost: pool.totalCostGbp,
    transactionId: transaction.id,
  })
}

/**
 * Match a disposal against the Section 104 pool
 */
function matchAgainstPool(
  pool: Section104Pool,
  transaction: EnrichedTransaction,
  quantity: number
): MatchingResult | null {
  if (pool.quantity <= 0) {
    console.warn(`Cannot match disposal ${transaction.id}: Section 104 pool for ${pool.symbol} is empty`)
    return null
  }

  // Can only match up to available pool quantity
  const quantityToMatch = Math.min(quantity, pool.quantity)

  // Calculate cost basis at average cost
  const costBasisGbp = pool.averageCostGbp * quantityToMatch

  // Update pool
  pool.quantity -= quantityToMatch
  pool.totalCostGbp -= costBasisGbp
  pool.averageCostGbp = pool.quantity > 0 ? pool.totalCostGbp / pool.quantity : 0

  // Calculate proceeds (including selling fees, use split-adjusted price if available)
  const pricePerShare = getEffectivePrice(transaction)
  const effectiveQuantity = getEffectiveQuantity(transaction)
  const feePerShare = transaction.fee_gbp ? transaction.fee_gbp / Math.max(effectiveQuantity, 1) : 0
  const proceedsPerShare = pricePerShare - feePerShare
  const proceeds = proceedsPerShare * quantityToMatch

  // Record in history
  pool.history.push({
    date: transaction.date,
    type: 'SELL',
    quantity: quantityToMatch,
    costOrProceeds: proceeds,
    balanceQuantity: pool.quantity,
    balanceCost: pool.totalCostGbp,
    transactionId: transaction.id,
  })

  // Create a synthetic acquisition representing the pool
  const poolAcquisition: MatchingResult['acquisitions'][0] = {
    transaction: {
      ...transaction,
      id: `${transaction.id}-s104-pool`,
      type: TransactionType.BUY,
      price_gbp: pool.averageCostGbp,
      quantity: quantityToMatch,
    },
    quantityMatched: quantityToMatch,
    costBasisGbp,
  }

  return {
    disposal: transaction,
    acquisitions: [poolAcquisition],
    rule: 'SECTION_104',
    quantityMatched: quantityToMatch,
    totalCostBasisGbp: costBasisGbp,
  }
}

/**
 * Mark transactions as matched under Section 104 rule
 *
 * Marks both:
 * - SELL transactions that were matched against the pool
 * - BUY transactions that were added to the pool
 */
export function markSection104Matches(
  transactions: EnrichedTransaction[],
  matchings: MatchingResult[],
  pools: Map<string, Section104Pool>
): EnrichedTransaction[] {
  const matchedTxIds = new Set<string>()

  // Collect all SELL transaction IDs involved in Section 104 matches
  for (const matching of matchings) {
    // Only mark if not already marked by previous rules
    if (matching.disposal.gain_group === 'NONE') {
      matchedTxIds.add(matching.disposal.id)
    }
  }

  // Collect all BUY transaction IDs that were added to Section 104 pools
  for (const pool of pools.values()) {
    for (const historyEntry of pool.history) {
      if (historyEntry.type === 'BUY') {
        matchedTxIds.add(historyEntry.transactionId)
      }
    }
  }

  // Update gain_group for matched transactions
  return transactions.map(tx => {
    if (matchedTxIds.has(tx.id) && tx.gain_group === 'NONE') {
      return { ...tx, gain_group: 'SECTION_104' }
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
