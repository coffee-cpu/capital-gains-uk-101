/**
 * Format a GBP amount for display. Negative amounts use accounting brackets,
 * matching the "Gain/(Loss)" labels: -5897.75 → "(£5,897.75)".
 */
export function formatGbp(value: number, fractionDigits = 2): string {
  const formatted = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  // Amounts that round to zero (including -0) are shown without brackets
  const isNegative = value < 0 && formatted.replace(/[0.,]/g, '') !== ''
  return isNegative ? `(£${formatted})` : `£${formatted}`
}
