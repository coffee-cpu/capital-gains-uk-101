import { GenericTransaction, TransactionType } from '../../types/transaction'
import { RawCSVRow } from '../../types/broker'
import { SkippedRow } from '../../types/brokerDefinition'

/**
 * Expected CSV columns for generic format:
 * - symbol (required)
 * - name (optional)
 * - date (required, YYYY-MM-DD format)
 * - type (required, one of: BUY, SELL, DIVIDEND, FEE, INTEREST, TRANSFER, TAX, STOCK_SPLIT)
 * - quantity (optional, number)
 * - price (optional, number)
 * - currency (required, e.g., USD, GBP, EUR)
 * - total (optional, number)
 * - fee (optional, number)
 * - split_ratio (optional, for STOCK_SPLIT only, e.g., "10:1", "2:1")
 * - notes (optional, text)
 */

/**
 * Normalize generic CSV rows in our standard format
 * @param rows Raw CSV rows
 * @param fileId Unique identifier for this file
 * @param skippedRows If given, receives every row that was dropped and why
 */
export function normalizeGenericTransactions(
  rows: RawCSVRow[],
  fileId: string,
  skippedRows?: SkippedRow[]
): GenericTransaction[] {
  const transactions: GenericTransaction[] = []
  let rowIndex = 1

  rows.forEach((row, index) => {
    // Spreadsheets save blank rows as ",,,,": nothing was lost, so don't report them
    if (Object.values(row).every(value => !value?.trim())) return

    const normalized = normalizeGenericRow(row, fileId, rowIndex)
    if (typeof normalized === 'string') {
      skippedRows?.push({ row: index + 1, reason: normalized })
    } else {
      transactions.push(normalized)
      rowIndex++
    }
  })

  return transactions
}

/**
 * Normalize a single generic row
 * @returns The transaction, or the reason the row was skipped
 */
function normalizeGenericRow(
  row: RawCSVRow,
  fileId: string,
  rowIndex: number
): GenericTransaction | string {
  // Required fields
  const symbol = row['symbol']?.trim() || ''
  const dateStr = row['date']?.trim()
  const typeStr = row['type']?.trim()
  const currency = row['currency']?.trim() || 'USD'

  if (!dateStr) {
    return 'missing date'
  }
  if (!typeStr) {
    return 'missing type'
  }

  // Validate transaction type
  const type = parseGenericType(typeStr)
  if (!type) {
    return `unrecognised type "${typeStr}"`
  }

  // Optional fields
  const name = row['name']?.trim() || null
  const quantity = row['quantity'] ? (isNaN(parseFloat(row['quantity'])) ? null : parseFloat(row['quantity'])) : null
  const price = row['price'] ? (isNaN(parseFloat(row['price'])) ? null : parseFloat(row['price'])) : null
  const total = row['total'] ? (isNaN(parseFloat(row['total'])) ? null : parseFloat(row['total'])) : null
  const fee = row['fee'] ? (isNaN(parseFloat(row['fee'])) ? null : parseFloat(row['fee'])) : null
  const notes = row['notes']?.trim() || null
  const ratio = row['split_ratio']?.trim() || null

  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Generic CSV',
    symbol,
    name,
    date: dateStr,
    type,
    quantity,
    price,
    currency,
    total,
    fee,
    notes,
    ratio,
  }
}

/**
 * Validate transaction type string
 */
function parseGenericType(typeStr: string): typeof TransactionType[keyof typeof TransactionType] | null {
  const typeUpper = typeStr?.trim().toUpperCase()

  // Check if it's a valid TransactionType
  if (typeUpper && typeUpper in TransactionType) {
    return typeUpper as typeof TransactionType[keyof typeof TransactionType]
  }

  return null
}
