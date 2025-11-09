import { GenericTransaction, TransactionType } from '../../types/transaction'
import { RawCSVRow } from '../../types/broker'

/**
 * Normalize Interactive Brokers CSV rows to GenericTransaction format
 *
 * IB CSV has a multi-section format:
 * - First column: Section name (e.g., "Trades", "Cash Transactions", "Corporate Actions")
 * - Second column: Row type ("Header" or "Data")
 * - Variable columns per section
 *
 * We focus on the "Trades" section for buy/sell transactions
 *
 * @param rows Raw CSV rows
 * @param fileId Unique identifier for this file
 */
export function normalizeInteractiveBrokersTransactions(rows: RawCSVRow[], fileId: string): GenericTransaction[] {
  const transactions: GenericTransaction[] = []
  let rowIndex = 1

  // PapaParse with header:true already consumed the header row to create column names
  // So all rows we receive are data rows with keys like: "Trades", "Header", "DataDiscriminator", etc.
  // The first CSV row (Trades,Header,DataDiscriminator,...) became the column names
  // All subsequent rows are data rows where row["Trades"] = "Trades", row["Header"] = "Data", etc.

  for (const row of rows) {
    const sectionName = row['Trades']
    const rowType = row['Header']

    // Process only "Trades,Data" rows (skip other sections)
    if (sectionName === 'Trades' && rowType === 'Data') {
      const normalized = normalizeIBTradeRow(row, fileId, rowIndex)
      if (normalized) {
        transactions.push(normalized)
        rowIndex++
      }
    }
  }

  return transactions
}

/**
 * Normalize a single IB trade row
 */
function normalizeIBTradeRow(
  row: RawCSVRow,
  fileId: string,
  rowIndex: number
): GenericTransaction | null {
  // With PapaParse header:true, row is already a key-value object
  // where keys are column names from the first row
  // row = { "Trades": "Trades", "Header": "Data", "DataDiscriminator": "Trade", ... }

  // Extract DataDiscriminator to filter row types
  // We only want "Trade" rows (actual executions), not "Order", "ClosedLot", or "SubTotal"
  const dataDiscriminator = row['DataDiscriminator']
  if (dataDiscriminator !== 'Trade') {
    return null
  }

  // Extract key fields directly from row object
  const symbol = row['Symbol']?.trim()
  const currency = row['Currency']?.trim()
  const assetCategory = row['Asset Category']?.trim()
  const dateTime = parseIBDateTime(row['Date/Time'])

  if (!dateTime || !symbol) {
    return null // Skip invalid rows
  }

  // Parse numeric values
  const quantity = parseFloat(row['Quantity']) || null
  const tPrice = parseFloat(row['T. Price']) || null
  const proceeds = parseFloat(row['Proceeds']) || null
  const commFee = Math.abs(parseFloat(row['Comm/Fee']) || 0)

  // Determine transaction type based on quantity sign
  // In IB CSV: positive quantity = BUY, negative quantity = SELL
  const type = quantity && quantity < 0 ? TransactionType.SELL : TransactionType.BUY

  // Calculate total from proceeds (make positive)
  const total = proceeds !== null ? Math.abs(proceeds) : null

  // For now, we only support stocks. Options and other asset types can be added later
  const isStock = assetCategory === 'Stocks'
  if (!isStock) {
    return null // Skip non-stock transactions for now
  }

  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Interactive Brokers',
    symbol: symbol,
    name: null, // IB doesn't provide a description in the trades section
    date: dateTime,
    type,
    quantity: quantity !== null ? Math.abs(quantity) : null, // Store as positive
    price: tPrice,
    currency: currency || 'USD',
    total,
    fee: commFee || null,
    ratio: null,
    notes: null,
    incomplete: false,
    ignored: false,
  }
}

/**
 * Parse IB date/time format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD;HH:MM:SS"
 * Returns ISO date string (YYYY-MM-DD) or null
 */
function parseIBDateTime(dateTimeStr: string): string | null {
  if (!dateTimeStr) return null

  // Handle both semicolon and space separators
  const datePart = dateTimeStr.split(/[; ]/)[0].trim()

  // Validate ISO date format
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  return datePart
}
