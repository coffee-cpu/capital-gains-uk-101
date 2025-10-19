import type { GenericTransaction } from '../../types/transaction'
import type { RawCSVRow } from '../../types/broker'

/**
 * Trading 212 CSV Parser
 *
 * Converts Trading 212 transaction exports to GenericTransaction format
 *
 * Expected columns:
 * - Action: Transaction type (Market buy, Limit sell, Dividend, Deposit, etc.)
 * - Time: Timestamp (YYYY-MM-DD HH:MM:SS)
 * - ISIN: Security identifier
 * - Ticker: Stock symbol
 * - Name: Company name
 * - No. of shares: Quantity
 * - Price / share: Unit price
 * - Currency (Price / share): Price currency
 * - Exchange rate: FX rate to account currency
 * - Result: Profit/loss (for sales)
 * - Currency (Result): Result currency
 * - Total: Total value
 * - Currency (Total): Total currency
 * - Withholding tax: Tax withheld
 * - Currency (Withholding tax): Tax currency
 * - Transaction fee: Trading fee
 * - Currency (Transaction fee): Fee currency
 * - Currency conversion fee: FX fee
 * - Currency (Currency conversion fee): FX fee currency
 * - Notes: Additional info
 * - ID: Unique transaction ID
 */

/**
 * Map Trading 212 action to transaction type
 */
function mapActionToType(action: string): 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE' | 'INTEREST' | 'TRANSFER' | 'TAX' {
  const actionLower = action.toLowerCase()

  // Buy actions: Market buy, Limit buy, Stop buy
  if (actionLower.includes('buy')) return 'BUY'

  // Sell actions: Market sell, Limit sell, Stop sell
  if (actionLower.includes('sell')) return 'SELL'

  // Dividend actions: Dividend (Ordinary), Dividend (Dividend), Dividend (Dividends paid by us corporations)
  if (actionLower.includes('dividend')) return 'DIVIDEND'

  // Interest actions: Interest on cash, Lending interest
  if (actionLower.includes('interest')) return 'INTEREST'

  // Transfer actions: Deposit, Withdrawal
  if (actionLower === 'deposit' || actionLower === 'withdrawal') return 'TRANSFER'

  // Stock splits - Trading 212 specific (not in our transaction types, treat as FEE/adjustment)
  if (actionLower === 'stock split') return 'FEE'

  // Result adjustment - Trading 212 specific
  if (actionLower === 'result adjustment') return 'FEE'

  // Tax-related
  if (actionLower.includes('tax') || actionLower.includes('withholding')) return 'TAX'

  // Unknown actions - default to FEE
  console.warn(`Unknown Trading 212 action: "${action}", treating as FEE`)
  return 'FEE'
}

/**
 * Parse Trading 212 date format: "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DD"
 */
function parseDate(dateStr: string): string {
  // Trading 212 uses: "2025-09-09 07:03:13"
  // We need: "2025-09-09"
  return dateStr.split(' ')[0]
}

/**
 * Parse numeric value, handling empty strings and various formats
 */
function parseNumber(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined

  // Remove any currency symbols and commas
  const cleaned = value.replace(/[£$€,]/g, '').trim()
  const parsed = parseFloat(cleaned)

  return isNaN(parsed) ? undefined : parsed
}

/**
 * Normalize Trading 212 transactions to GenericTransaction format
 */
export function normalizeTrading212Transactions(
  rows: RawCSVRow[],
  fileId: string
): GenericTransaction[] {
  return rows
    .map((row, index) => {
      const action = row['Action']
      const time = row['Time']
      const ticker = row['Ticker']
      const name = row['Name']

      // Skip rows without essential data
      if (!action || !time) return null

      const type = mapActionToType(action)

      // Parse numeric fields
      const quantity = parseNumber(row['No. of shares'])
      const price = parseNumber(row['Price / share'])
      const csvTotal = parseNumber(row['Total'])
      const transactionFee = parseNumber(row['Transaction fee'])
      const currencyConversionFee = parseNumber(row['Currency conversion fee'])
      const withholdingTax = parseNumber(row['Withholding tax'])

      // Combine all fees
      let fee: number | undefined
      if (transactionFee || currencyConversionFee) {
        fee = (transactionFee || 0) + (currencyConversionFee || 0)
      }

      // Get currencies - use price currency as the transaction currency
      // Trading 212 stores the original price in its native currency,
      // and converts total to account currency (usually GBP)
      const priceCurrency = row['Currency (Price / share)']
      const totalCurrency = row['Currency (Total)']

      // The transaction currency should be the price currency (e.g., USD for US stocks)
      // NOT the total currency (which is the account currency after conversion)
      const currency = priceCurrency || totalCurrency || 'GBP'

      // For BUY/SELL: Calculate total from price × quantity in the original currency
      // For others (DIVIDEND, INTEREST, TRANSFER): Use the CSV total (already in correct currency)
      let total: number | null = null
      if (type === 'BUY' || type === 'SELL') {
        // Calculate from price × quantity for buy/sell transactions
        total = price !== undefined && price !== null &&
                quantity !== undefined && quantity !== null
          ? price * quantity
          : null
      } else {
        // Use CSV total for non-trading transactions (dividends, interest, transfers)
        total = csvTotal ?? null
      }

      const transaction: GenericTransaction = {
        id: `${fileId}-${index + 1}`,
        source: 'Trading 212',
        date: parseDate(time),
        type,
        symbol: ticker || '',
        name: name || null,
        quantity: quantity ?? null,
        price: price ?? null,
        currency,
        total,
        fee: fee ?? null,
        notes: row['Notes'] || null,
      }

      // Add withholding tax as a note if present
      if (withholdingTax && withholdingTax > 0) {
        const taxCurrency = row['Currency (Withholding tax)'] || currency
        const taxNote = `Withholding tax: ${withholdingTax} ${taxCurrency}`
        transaction.notes = transaction.notes
          ? `${transaction.notes}; ${taxNote}`
          : taxNote
      }

      return transaction
    })
    .filter((t): t is GenericTransaction => t !== null)
}
