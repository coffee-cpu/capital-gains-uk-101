/**
 * Shared parsing utilities for CSV parsers
 *
 * These utilities handle common parsing patterns across all broker parsers:
 * - Date parsing from various formats to ISO YYYY-MM-DD
 * - Number/currency parsing with symbol and comma handling
 * - Currency code extraction from formatted amounts
 */

/**
 * Parse a numeric value, handling empty strings, currency symbols, and commas
 * Returns undefined for empty/invalid values
 */
export function parseNumber(value: string | undefined | null): number | undefined {
  if (!value || value.trim() === '') return undefined

  // Remove currency symbols ($, £, €), thousands separators and spaces, then
  // a leading or trailing ISO currency code ("USD 1,500.00", "-USD 5", "12.50 GBP")
  const stripCodes = (text: string) => text.replace(/^(-?)[A-Z]{3}/, '$1').replace(/[A-Z]{3}$/, '')
  let cleaned = stripCodes(value.replace(/[$£€,\s]/g, ''))

  // Accounting-style negatives: "(1,234.56)" means -1234.56. Codes are stripped
  // on both sides of the unwrap, so "USD (5.00)", "(5.00) USD" and
  // "(USD 5.00)" all work.
  const accounting = /^\((.*)\)$/.exec(cleaned)
  if (accounting) cleaned = stripCodes(`-${accounting[1]}`)

  const parsed = parseFloat(cleaned)

  return isNaN(parsed) ? undefined : parsed
}

/**
 * Parse a currency value, handling format like "$1,234.56" or "-$1,234.56"
 * Returns null for empty/invalid values (matches GenericTransaction field types)
 */
export function parseCurrency(value: string | undefined | null): number | null {
  const result = parseNumber(value)
  return result === undefined ? null : result
}

/**
 * Extract date part from ISO 8601 timestamp
 * Handles formats like "2024-01-15T10:00:00.000Z" -> "2024-01-15"
 */
export function parseISODate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null

  const [, year, month, day] = match
  return `${year}-${month}-${day}`
}

/**
 * Parse US date format (MM/DD/YYYY) to ISO (YYYY-MM-DD)
 */
export function parseUSDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null

  const match = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null

  const [, month, day, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/**
 * Extract currency code from amount string with currency symbol
 * Falls back to provided default if no symbol detected
 */
export function extractCurrencyFromAmount(amount: string | undefined | null, defaultCurrency = 'USD'): string {
  if (!amount) return defaultCurrency

  if (amount.includes('$')) return 'USD'
  if (amount.includes('£')) return 'GBP'
  if (amount.includes('€')) return 'EUR'

  return defaultCurrency
}

/**
 * Calculate total from price and quantity if amount is not available
 */
export function calculateTotal(
  amount: number | null,
  quantity: number | null,
  price: number | null
): number | null {
  if (amount !== null) return Math.abs(amount)
  if (quantity !== null && price !== null) return Math.abs(quantity * price)
  return null
}
