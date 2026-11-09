/**
 * Format a share, contract or coin quantity for display: at least two
 * decimal places (500 → "500.00", matching the money columns) and up to
 * eight, so fractional shares and small crypto amounts don't show as 0.00
 * (0.00012345 → "0.00012345"). No thousands separator.
 */
export function formatQuantity(quantity: number): string {
  return quantity.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
    useGrouping: false,
  })
}
