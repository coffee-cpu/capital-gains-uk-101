import type { GenericTransaction } from '../../types/transaction'
import type { RawCSVRow } from '../../types/broker'

/**
 * Revolut CSV Parser
 *
 * Converts Revolut transaction exports to GenericTransaction format
 *
 * Expected columns:
 * - Date: ISO 8601 timestamp (e.g., "2024-01-15T10:00:00.000000Z")
 * - Ticker: Stock symbol (empty for cash transactions)
 * - Type: Transaction type (BUY - MARKET, SELL - MARKET, DIVIDEND, CUSTODY FEE, etc.)
 * - Quantity: Number of shares
 * - Price per share: Unit price
 * - Total Amount: Total value with currency symbol
 * - Currency: Transaction currency (e.g., "USD")
 * - FX Rate: Exchange rate to GBP
 */

/**
 * Map Revolut type to transaction type
 */
function mapTypeToTransactionType(type: string): 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE' | 'INTEREST' | 'TRANSFER' | 'TAX' | 'STOCK_SPLIT' {
  const typeLower = type.toLowerCase()

  // Buy actions: BUY - MARKET, BUY - LIMIT
  if (typeLower.includes('buy')) return 'BUY'

  // Sell actions: SELL - MARKET, SELL - LIMIT
  if (typeLower.includes('sell')) return 'SELL'

  // Dividend actions
  if (typeLower.includes('dividend')) return 'DIVIDEND'

  // Cash movements
  if (typeLower.includes('cash top-up') || typeLower.includes('cash withdrawal')) return 'TRANSFER'

  // Fees
  if (typeLower.includes('custody fee') || typeLower.includes('fee')) return 'FEE'

  // Transfers between Revolut entities
  if (typeLower.includes('transfer from revolut')) return 'TRANSFER'

  // Stock splits
  if (typeLower.includes('stock split')) return 'STOCK_SPLIT'

  // Tax-related
  if (typeLower.includes('tax')) return 'TAX'

  // Unknown types - default to FEE
  console.warn(`Unknown Revolut type: "${type}", treating as FEE`)
  return 'FEE'
}

/**
 * Parse Revolut date format: "2024-01-15T10:00:00.000000Z" -> "2024-01-15"
 */
function parseDate(dateStr: string): string {
  // Revolut uses ISO 8601 format with microseconds
  // Extract just the date part (YYYY-MM-DD)
  return dateStr.split('T')[0]
}

/**
 * Parse numeric value, handling empty strings and currency symbols
 */
function parseNumber(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined

  // Remove currency symbols ($, £, €) and commas, preserve negative sign
  const cleaned = value.replace(/[$£€,]/g, '').trim()
  const parsed = parseFloat(cleaned)

  return isNaN(parsed) ? undefined : parsed
}

/**
 * Extract currency symbol from amount string (e.g., "$1,000" -> "USD")
 * Falls back to the Currency column if no symbol detected
 */
function extractCurrency(amount: string | undefined, currencyColumn: string): string {
  if (!amount) return currencyColumn || 'USD'

  // Map currency symbols to currency codes
  if (amount.includes('$')) return 'USD'
  if (amount.includes('£')) return 'GBP'
  if (amount.includes('€')) return 'EUR'

  return currencyColumn || 'USD'
}

/**
 * Normalize Revolut transactions to GenericTransaction format
 */
export function normalizeRevolutTransactions(
  rows: RawCSVRow[],
  fileId: string
): GenericTransaction[] {
  return rows
    .map((row, index) => {
      const date = row['Date']
      const ticker = row['Ticker']
      const type = row['Type']
      const totalAmount = row['Total Amount']
      const currencyColumn = row['Currency']

      // Skip rows without essential data
      if (!date || !type) return null

      const transactionType = mapTypeToTransactionType(type)

      // Parse numeric fields
      const quantity = parseNumber(row['Quantity'])
      const pricePerShare = parseNumber(row['Price per share'])
      const total = parseNumber(totalAmount)

      // Determine currency from Total Amount column (has currency symbol) or Currency column
      const currency = extractCurrency(totalAmount, currencyColumn)

      // For transfers and fees, there's no ticker
      const symbol = ticker?.trim() || ''

      const transaction: GenericTransaction = {
        id: `${fileId}-${index + 1}`,
        source: 'Revolut',
        date: parseDate(date),
        type: transactionType,
        symbol,
        name: null,
        quantity: quantity ?? null,
        price: pricePerShare ?? null,
        currency,
        total: total ?? null,
        fee: null, // Revolut doesn't separate fees in this format
        notes: type || null,
      }

      return transaction
    })
    .filter((t): t is GenericTransaction => t !== null)
}
