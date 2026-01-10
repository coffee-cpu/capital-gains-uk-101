import { EnrichedTransaction, TransactionType } from '../../types/transaction'

/**
 * Get the unit label for shares vs options contracts
 *
 * Returns "contracts" for options transactions (those with underlying_symbol set),
 * or "shares" for regular stock transactions.
 *
 * @param tx Transaction or object with underlying_symbol field
 * @param plural Whether to return plural form (default: true)
 * @returns "contracts"/"contract" for options, "shares"/"share" for stocks
 */
export function getUnitLabel(tx: { underlying_symbol?: string | null }, plural: boolean = true): string {
  const isOptions = tx.underlying_symbol != null
  if (plural) {
    return isOptions ? 'contracts' : 'shares'
  }
  return isOptions ? 'contract' : 'share'
}

/**
 * Get the effective quantity for CGT matching purposes
 *
 * Returns split-adjusted quantity if stock splits occurred,
 * otherwise returns the original quantity.
 *
 * For OPTIONS_EXPIRED and OPTIONS_ASSIGNED with negative quantities
 * (indicating closing a long position), returns the absolute value
 * since the matching logic expects positive quantities.
 *
 * This ensures CGT matching uses consistent quantity basis after stock splits.
 *
 * @param transaction Transaction to get quantity from
 * @returns Split-adjusted quantity if available, otherwise original quantity (always positive)
 */
export function getEffectiveQuantity(transaction: EnrichedTransaction): number {
  // Use split-adjusted quantity if available (i.e., stock splits occurred)
  // Otherwise fall back to original quantity
  const quantity = transaction.split_adjusted_quantity ?? transaction.quantity ?? 0

  // For OPTIONS_EXPIRED and OPTIONS_ASSIGNED, quantity can be negative
  // (negative = closing a long position). Return absolute value for matching.
  if (transaction.type === TransactionType.OPTIONS_EXPIRED ||
      transaction.type === TransactionType.OPTIONS_ASSIGNED) {
    return Math.abs(quantity)
  }

  return quantity
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

/**
 * Check if a transaction is an acquisition (increases holdings)
 *
 * Includes:
 * - BUY: Regular stock purchase
 * - OPTIONS_BUY_TO_OPEN: Opening a long options position (cost = premium paid)
 * - OPTIONS_BUY_TO_CLOSE: Closing a short options position (cost to close)
 * - OPTIONS_EXPIRED with positive quantity: Closes a short position at £0 cost
 * - OPTIONS_ASSIGNED with positive quantity: Closes a short position (stock is delivered)
 */
export function isAcquisition(transaction: EnrichedTransaction): boolean {
  if (transaction.type === TransactionType.BUY ||
      transaction.type === TransactionType.OPTIONS_BUY_TO_OPEN ||
      transaction.type === TransactionType.OPTIONS_BUY_TO_CLOSE) {
    return true
  }

  // For OPTIONS_EXPIRED and OPTIONS_ASSIGNED, check the quantity sign
  // Positive quantity = closing a short position (acquisition at £0)
  // Negative quantity = closing a long position (disposal at £0)
  if (transaction.type === TransactionType.OPTIONS_EXPIRED ||
      transaction.type === TransactionType.OPTIONS_ASSIGNED) {
    const quantity = transaction.quantity ?? 0
    return quantity >= 0
  }

  return false
}

/**
 * Check if a transaction is a disposal (decreases holdings / generates proceeds)
 *
 * Includes:
 * - SELL: Regular stock sale
 * - OPTIONS_SELL_TO_CLOSE: Closing a long options position (proceeds from sale)
 * - OPTIONS_SELL_TO_OPEN: Opening a short options position (proceeds = premium received)
 * - OPTIONS_EXPIRED with negative quantity: Closes a long position at £0 proceeds
 * - OPTIONS_ASSIGNED with negative quantity: Closes a long position (stock is delivered)
 */
export function isDisposal(transaction: EnrichedTransaction): boolean {
  if (transaction.type === TransactionType.SELL ||
      transaction.type === TransactionType.OPTIONS_SELL_TO_CLOSE ||
      transaction.type === TransactionType.OPTIONS_SELL_TO_OPEN) {
    return true
  }

  // For OPTIONS_EXPIRED and OPTIONS_ASSIGNED, check the quantity sign
  // Negative quantity = closing a long position (disposal at £0)
  // Positive quantity = closing a short position (acquisition at £0)
  if (transaction.type === TransactionType.OPTIONS_EXPIRED ||
      transaction.type === TransactionType.OPTIONS_ASSIGNED) {
    const quantity = transaction.quantity ?? 0
    return quantity < 0
  }

  return false
}
