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

type TransactionTypeString = 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE' | 'INTEREST' | 'TRANSFER' | 'TAX' | 'STOCK_SPLIT'

/**
 * Keyword-based mappings for Revolut types (checked in order)
 * Order matters: more specific patterns should come first
 */
const REVOLUT_TYPE_MAP: Array<{ keyword: string; type: TransactionTypeString }> = [
  { keyword: 'buy', type: 'BUY' },
  { keyword: 'sell', type: 'SELL' },
  { keyword: 'dividend', type: 'DIVIDEND' },
  { keyword: 'cash top-up', type: 'TRANSFER' },
  { keyword: 'cash withdrawal', type: 'TRANSFER' },
  { keyword: 'transfer from revolut', type: 'TRANSFER' },
  { keyword: 'custody fee', type: 'FEE' },
  { keyword: 'fee', type: 'FEE' },
  { keyword: 'stock split', type: 'STOCK_SPLIT' },
  { keyword: 'tax', type: 'TAX' },
]

/**
 * Map Revolut type to transaction type
 */
function mapTypeToTransactionType(type: string): TransactionTypeString {
  const typeLower = type.toLowerCase()

  for (const { keyword, type: txType } of REVOLUT_TYPE_MAP) {
    if (typeLower.includes(keyword)) {
      return txType
    }
  }

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
