import { EnrichedTransaction, TransactionType } from '../../types/transaction'
import { Section104Pool, MatchingResult } from '../../types/cgt'
import { MatchingStage } from './pipeline'
import {
  getEffectiveQuantity,
  getEffectivePrice,
  isAcquisition,
  isDisposal,
  groupBySymbol,
  getRemainingQuantity,
  calculateCostBasis,
} from './utils'

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

      if (isAcquisition(tx)) {
        // Add to pool
        addToPool(pool, tx, remainingQuantity)
      } else if (isDisposal(tx)) {
        // Match against pool (always returns a result, even if pool is empty/insufficient)
        const matching = matchAgainstPool(pool, tx, remainingQuantity)
        matchings.push(matching)
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
  const totalCost = calculateCostBasis(transaction, quantity)

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
 *
 * Returns a MatchingResult even if the pool is empty or insufficient.
 * This allows us to track unmatched disposals for user transparency.
 */
function matchAgainstPool(
  pool: Section104Pool,
  transaction: EnrichedTransaction,
  quantity: number
): MatchingResult {
  // Can only match up to available pool quantity (0 if pool is empty)
  const quantityToMatch = Math.min(quantity, Math.max(0, pool.quantity))

  // Calculate cost basis at average cost (0 if pool is empty)
  const costBasisGbp = pool.averageCostGbp * quantityToMatch

  // Update pool only if we matched something
  if (quantityToMatch > 0) {
    pool.quantity -= quantityToMatch
    pool.totalCostGbp -= costBasisGbp
    pool.averageCostGbp = pool.quantity > 0 ? pool.totalCostGbp / pool.quantity : 0
  }

  // Calculate proceeds (including selling fees, use split-adjusted price if available)
  const pricePerShare = getEffectivePrice(transaction)
  const effectiveQuantity = getEffectiveQuantity(transaction)
  const feePerShare = transaction.fee_gbp ? transaction.fee_gbp / Math.max(effectiveQuantity, 1) : 0
  const proceedsPerShare = pricePerShare - feePerShare
  const proceeds = proceedsPerShare * quantityToMatch

  // Record in history only if we matched something
  if (quantityToMatch > 0) {
    pool.history.push({
      date: transaction.date,
      type: 'SELL',
      quantity: quantityToMatch,
      costOrProceeds: proceeds,
      balanceQuantity: pool.quantity,
      balanceCost: pool.totalCostGbp,
      transactionId: transaction.id,
    })
  }

  // Create a synthetic acquisition representing the pool (empty array if nothing matched)
  const acquisitions: MatchingResult['acquisitions'] = quantityToMatch > 0 ? [{
    transaction: {
      ...transaction,
      id: `${transaction.id}-s104-pool`,
      type: TransactionType.BUY,
      price_gbp: pool.averageCostGbp,
      quantity: quantityToMatch,
    },
    quantityMatched: quantityToMatch,
    costBasisGbp,
  }] : []

  return {
    disposal: transaction,
    acquisitions,
    rule: 'SECTION_104',
    quantityMatched: quantityToMatch,
    totalCostBasisGbp: costBasisGbp,
  }
}

/**
 * Section 104 Pool Pipeline Stage (TCGA92/S104)
 *
 * Matches remaining disposals against the pooled average cost basis.
 * This stage runs last and handles all transactions not matched by prior rules.
 */
export const section104Stage: MatchingStage = {
  name: 'section-104',
  apply(context) {
    const [matchings, pools] = applySection104Pooling(context.transactions, context.matchings)
    return {
      ...context,
      matchings: [...context.matchings, ...matchings],
      section104Pools: pools,
    }
  },
}

