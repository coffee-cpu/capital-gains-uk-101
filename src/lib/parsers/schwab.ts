import { GenericTransaction, TransactionType } from '../../types/transaction'
import { RawCSVRow } from '../../types/broker'

/**
 * Normalize Schwab CSV rows to GenericTransaction format
 * @param rows Raw CSV rows
 * @param fileId Unique identifier for this file (e.g. 'schwab-abc123')
 */
export function normalizeSchwabTransactions(rows: RawCSVRow[], fileId: string): GenericTransaction[] {
  const transactions: GenericTransaction[] = []
  let rowIndex = 1

  for (const row of rows) {
    const normalized = normalizeSchwabRow(row, fileId, rowIndex)
    if (normalized) {
      transactions.push(normalized)
      rowIndex++
    }
  }

  return transactions
}

/**
 * Normalize a single Schwab row
 */
function normalizeSchwabRow(row: RawCSVRow, fileId: string, rowIndex: number): GenericTransaction | null {
  const action = row['Action']?.trim()
  const symbol = row['Symbol']?.trim()
  const date = parseSchwabDate(row['Date'])

  if (!date) {
    return null // Skip rows with invalid dates
  }

  // Map Schwab action to transaction type
  const type = mapSchwabAction(action)
  if (!type) {
    return null // Skip unknown actions for now
  }

  // Parse numeric values
  const quantity = parseFloat(row['Quantity']) || null
  const price = parseSchwabCurrency(row['Price']) || null
  const fee = parseSchwabCurrency(row['Fees & Comm']) || null
  const amount = parseSchwabCurrency(row['Amount']) || null

  // Calculate total (for buys, amount is negative, for sells positive)
  const total = amount !== null ? Math.abs(amount) : (quantity && price ? quantity * price : null)

  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Charles Schwab',
    symbol: symbol || '',
    name: row['Description']?.trim() || null,
    date,
    type,
    quantity,
    price,
    currency: 'USD', // Schwab reports in USD
    total,
    fee,
    notes: null,
  }
}

/**
 * Map Schwab action to GenericTransaction type
 */
function mapSchwabAction(action: string): typeof TransactionType[keyof typeof TransactionType] | null {
  const actionLower = action?.toLowerCase() || ''

  if (actionLower === 'buy' || actionLower === 'stock plan activity') {
    return TransactionType.BUY
  }
  if (actionLower === 'sell') {
    return TransactionType.SELL
  }
  if (actionLower.includes('dividend')) {
    return TransactionType.DIVIDEND
  }
  if (actionLower.includes('interest')) {
    return TransactionType.INTEREST
  }
  if (actionLower.includes('fee') || actionLower.includes('tax')) {
    return TransactionType.FEE
  }

  return null // Unknown action
}

/**
 * Parse Schwab date format: "MM/DD/YYYY" or "MM/DD/YYYY as of MM/DD/YYYY"
 * Returns ISO date string (YYYY-MM-DD) or null
 */
function parseSchwabDate(dateStr: string): string | null {
  if (!dateStr) return null

  // Handle "as of" dates - use the first date
  const mainDate = dateStr.split(' as of ')[0].trim()

  const match = mainDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null

  const [, month, day, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/**
 * Parse Schwab currency format: "$1,234.56" or "-$1,234.56"
 * Returns number or null
 */
function parseSchwabCurrency(value: string): number | null {
  if (!value || value.trim() === '') return null

  // Remove $, commas, and parse
  const cleaned = value.replace(/[\$,]/g, '')
  const parsed = parseFloat(cleaned)

  return isNaN(parsed) ? null : parsed
}
