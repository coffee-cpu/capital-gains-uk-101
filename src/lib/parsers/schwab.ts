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
  const { type, isShortSell } = mapSchwabAction(action)
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

  // Check if this is Stock Plan Activity - these are always incomplete and should be ignored
  // Users should use Charles Schwab Equity Awards data instead, which has complete information
  const isStockPlanActivity = action?.toLowerCase() === 'stock plan activity'

  // Extract split ratio for STOCK_SPLIT transactions
  const ratio = type === TransactionType.STOCK_SPLIT
    ? parseSchwabStockSplitRatio(row['Description'])
    : null

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
    ratio,
    notes: isStockPlanActivity ? 'Stock Plan Activity - ignored in favor of Equity Awards data. Upload Charles Schwab Equity Awards file for complete information.' : null,
    incomplete: isStockPlanActivity,
    ignored: isStockPlanActivity, // Always ignore Stock Plan Activity transactions
    is_short_sell: isShortSell || undefined,
  }
}

interface SchwabActionResult {
  type: typeof TransactionType[keyof typeof TransactionType] | null
  isShortSell: boolean
}

/**
 * Map Schwab action to GenericTransaction type and short sell flag
 */
function mapSchwabAction(action: string): SchwabActionResult {
  const actionLower = action?.toLowerCase() || ''
  const isShortSell = actionLower === 'sell short'

  let type: typeof TransactionType[keyof typeof TransactionType]

  if (actionLower === 'buy' || actionLower === 'stock plan activity') {
    type = TransactionType.BUY
  } else if (actionLower === 'sell' || actionLower === 'sell short') {
    type = TransactionType.SELL
  } else if (actionLower === 'stock split') {
    type = TransactionType.STOCK_SPLIT
  } else if (actionLower.includes('dividend')) {
    type = TransactionType.DIVIDEND
  } else if (actionLower.includes('interest')) {
    type = TransactionType.INTEREST
  } else if (actionLower.includes('tax')) {
    type = TransactionType.TAX
  } else if (actionLower.includes('wire') || actionLower.includes('transfer')) {
    type = TransactionType.TRANSFER
  } else if (actionLower.includes('fee')) {
    type = TransactionType.FEE
  } else {
    // Return TRANSFER as a fallback for unknown actions so we don't filter them out
    type = TransactionType.TRANSFER
  }

  return { type, isShortSell }
}

/**
 * Parse Schwab date format: "MM/DD/YYYY" or "MM/DD/YYYY as of MM/DD/YYYY"
 * For "as of" dates (Stock Plan Activity), use the transaction date, not settlement date
 * Returns ISO date string (YYYY-MM-DD) or null
 */
function parseSchwabDate(dateStr: string): string | null {
  if (!dateStr) return null

  // Handle "as of" dates - use the "as of" date (transaction date) not settlement date
  const parts = dateStr.split(' as of ')
  const dateToUse = parts.length > 1 ? parts[1].trim() : parts[0].trim()

  const match = dateToUse.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
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

/**
 * Parse stock split ratio from Schwab description
 * Examples:
 *   "APPLE INC 4 FOR 1 STOCK SPLIT" -> "4:1"
 *   "NVIDIA CORP 10 FOR 1 STOCK SPLIT" -> "10:1"
 *   "COMPANY 1 FOR 10 STOCK SPLIT" -> "1:10" (reverse split)
 * Returns ratio string in "new:old" format or null if not found
 */
function parseSchwabStockSplitRatio(description: string | undefined): string | null {
  if (!description) return null

  // Match patterns like "4 FOR 1", "10 FOR 1", "1 FOR 10" (case insensitive)
  const match = description.match(/(\d+)\s+for\s+(\d+)/i)
  if (!match) return null

  const [, newShares, oldShares] = match
  return `${newShares}:${oldShares}`
}
