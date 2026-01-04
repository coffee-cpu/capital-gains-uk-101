import type { GenericTransaction } from '../../types/transaction'
import type { RawCSVRow } from '../../types/broker'

/**
 * Coinbase CSV Parser
 *
 * Converts Coinbase transaction exports to GenericTransaction format
 *
 * Note: The first 2 metadata rows are skipped by parseCoinbaseCSV() in csvParser.ts
 * before this function is called. So the rows we receive already have proper headers.
 *
 * Expected columns:
 * - ID: Unique transaction ID
 * - Timestamp: Transaction timestamp (YYYY-MM-DD HH:MM:SS UTC)
 * - Transaction Type: Type of transaction (Buy, Sell, Send, Receive, Staking Income, etc.)
 * - Asset: Crypto symbol (BTC, ETH, XTZ, etc.)
 * - Quantity Transacted: Amount of crypto
 * - Price Currency: Currency code (GBP, USD, EUR)
 * - Price at Transaction: Price per unit with currency symbol
 * - Subtotal: Subtotal before fees
 * - Total (inclusive of fees and/or spread): Total including fees
 * - Fees and/or Spread: Fee amount
 * - Notes: Additional info
 */

/**
 * Map Coinbase transaction type to GenericTransaction type
 */
function mapTransactionType(
  transactionType: string
): 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE' | 'INTEREST' | 'TRANSFER' | 'TAX' | 'STOCK_SPLIT' {
  const typeLower = transactionType.toLowerCase()

  // Buy transactions (including Advanced Trade Buy)
  if (typeLower === 'buy' || typeLower === 'advanced trade buy') return 'BUY'

  // Sell transactions (including Advanced Trade Sell)
  if (typeLower === 'sell' || typeLower === 'advanced trade sell') return 'SELL'

  // Staking and reward income - treat as INTEREST for CGT purposes
  if (typeLower === 'staking income' || typeLower === 'reward income') return 'INTEREST'

  // Transfers - Send, Receive, Deposit, Withdrawal, Pro Deposit, Pro Withdrawal
  if (
    typeLower === 'send' ||
    typeLower === 'receive' ||
    typeLower === 'deposit' ||
    typeLower === 'withdrawal' ||
    typeLower === 'pro deposit' ||
    typeLower === 'pro withdrawal'
  )
    return 'TRANSFER'

  // Convert transactions (crypto to crypto) - treat as SELL
  if (typeLower === 'convert') return 'SELL'

  // Retail staking/unstaking transfers - internal movements, treat as TRANSFER
  if (
    typeLower === 'retail staking transfer' ||
    typeLower === 'retail unstaking transfer' ||
    typeLower === 'retail eth2 deprecation'
  )
    return 'TRANSFER'

  // Unknown types - default to TRANSFER
  console.warn(`Unknown Coinbase transaction type: "${transactionType}", treating as TRANSFER`)
  return 'TRANSFER'
}

/**
 * Parse Coinbase date format: "YYYY-MM-DD HH:MM:SS UTC" -> "YYYY-MM-DD"
 */
function parseDate(dateStr: string): string {
  // Coinbase uses: "2025-12-31 11:08:09 UTC"
  // We need: "2025-12-31"
  return dateStr.split(' ')[0]
}

/**
 * Parse currency value, handling £/$/€ symbols and various formats
 * Examples: "£389.95711", "-£547.74001", "£0.00"
 */
function parseCurrencyValue(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null

  // Remove currency symbols (£, $, €) and commas
  const cleaned = value.replace(/[£$€,]/g, '').trim()
  const parsed = parseFloat(cleaned)

  return isNaN(parsed) ? null : parsed
}

/**
 * Parse quantity, handling scientific notation (e.g., "2.63622E-05")
 */
function parseQuantity(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null

  const parsed = parseFloat(value)
  return isNaN(parsed) ? null : parsed
}

/**
 * Normalize Coinbase transactions to GenericTransaction format
 */
export function normalizeCoinbaseTransactions(
  rows: RawCSVRow[],
  fileId: string
): GenericTransaction[] {
  return rows
    .map((row, index) => {
      const transactionType = row['Transaction Type']
      const timestamp = row['Timestamp']
      const asset = row['Asset']

      // Skip rows without essential data (handles metadata rows)
      if (!transactionType || !timestamp || !asset) return null

      // Skip if this looks like a header row
      if (transactionType === 'Transaction Type') return null

      const type = mapTransactionType(transactionType)

      // Parse numeric fields
      const quantity = parseQuantity(row['Quantity Transacted'])
      const price = parseCurrencyValue(row['Price at Transaction'])
      const subtotal = parseCurrencyValue(row['Subtotal'])
      const total = parseCurrencyValue(row['Total (inclusive of fees and/or spread)'])
      const fee = parseCurrencyValue(row['Fees and/or Spread'])

      // Get currency - Coinbase provides 'Price Currency' column
      const currency = row['Price Currency'] || 'GBP'

      // For total, prefer 'Total (inclusive of fees and/or spread)' for accuracy
      // Use subtotal as fallback, then calculate from price * quantity
      let finalTotal: number | null = null
      if (total !== null) {
        finalTotal = Math.abs(total) // Coinbase uses negative for some transactions
      } else if (subtotal !== null) {
        finalTotal = Math.abs(subtotal)
      } else if (price !== null && quantity !== null) {
        finalTotal = Math.abs(price * quantity)
      }

      // Handle quantity - Coinbase uses negative for Send transactions
      const finalQuantity = quantity !== null ? Math.abs(quantity) : null

      const transaction: GenericTransaction = {
        id: `${fileId}-${index + 1}`,
        source: 'Coinbase',
        date: parseDate(timestamp),
        type,
        symbol: asset,
        name: null, // Coinbase doesn't provide full asset names in CSV
        quantity: finalQuantity,
        price: price !== null ? Math.abs(price) : null,
        currency,
        total: finalTotal,
        fee: fee !== null ? Math.abs(fee) : null,
        notes: row['Notes'] || null,
      }

      return transaction
    })
    .filter((t): t is GenericTransaction => t !== null)
}
