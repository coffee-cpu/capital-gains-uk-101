import { EnrichedTransaction } from '../../types/transaction'

/**
 * Get the effective quantity for CGT matching purposes
 *
 * Returns split-adjusted quantity if stock splits occurred,
 * otherwise returns the original quantity.
 *
 * This ensures CGT matching uses consistent quantity basis after stock splits.
 *
 * @param transaction Transaction to get quantity from
 * @returns Split-adjusted quantity if available, otherwise original quantity
 */
export function getEffectiveQuantity(transaction: EnrichedTransaction): number {
  // Use split-adjusted quantity if available (i.e., stock splits occurred)
  // Otherwise fall back to original quantity
  return transaction.split_adjusted_quantity ?? transaction.quantity ?? 0
}

/**
 * Get the effective price in GBP for CGT matching purposes
 *
 * Returns split-adjusted price in GBP if stock splits occurred,
 * otherwise returns the original price in GBP.
 *
 * This ensures CGT matching uses consistent price basis after stock splits.
 *
 * @param transaction Transaction to get price from
 * @returns Split-adjusted price in GBP if available, otherwise original price in GBP
 */
export function getEffectivePrice(transaction: EnrichedTransaction): number {
  // Use split-adjusted price in GBP if available (i.e., stock splits occurred)
  // Otherwise fall back to original price in GBP
  return transaction.split_adjusted_price_gbp ?? transaction.price_gbp ?? 0
}
