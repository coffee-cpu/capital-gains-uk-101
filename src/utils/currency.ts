/**
 * Format a GBP amount for display. Negative amounts use accounting brackets,
 * matching the "Gain/(Loss)" labels: -5897.75 → "(£5,897.75)".
 */
export function formatGbp(value: number): string {
  const formatted = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  // Amounts that round to zero (including -0) are shown without brackets
  const isNegative = value < 0 && formatted.replace(/[0.,]/g, '') !== ''
  return isNegative ? `(£${formatted})` : `£${formatted}`
}

/**
 * Format a GBP amount in whole pounds, for chart labels and summary figures
 * where pence are noise: 1234.56 → "£1,235", -5000 → "-£5,000".
 */
export function formatGbpWhole(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}
