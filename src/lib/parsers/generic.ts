import { GenericTransaction, TransactionType } from '../../types/transaction'
import { RawCSVRow } from '../../types/broker'

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
 */
export function normalizeGenericTransactions(
  rows: RawCSVRow[],
  fileId: string
): GenericTransaction[] {
  const transactions: GenericTransaction[] = []
  let rowIndex = 1

  for (const row of rows) {
    const normalized = normalizeGenericRow(row, fileId, rowIndex)
    if (normalized) {
      transactions.push(normalized)
      rowIndex++
    }
  }

  return normalizeWithholdingSigns(transactions)
}

const isWithholdingTax = (tx: GenericTransaction): boolean =>
  tx.type === TransactionType.TAX_ON_DIVIDEND || tx.type === TransactionType.TAX_ON_INTEREST

/**
 * Bring withholding-tax rows to the signed convention (negative = tax
 * withheld, positive = refunded).
 *
 * Files exported by current versions already use it, so a negative tax row
 * means the file's signs can be trusted as written (refunds stay positive).
 * A file with no negative tax rows is an older export, which stored
 * withholding as a positive amount, or hand-entered tax; there every amount
 * is read as tax withheld.
 */
function normalizeWithholdingSigns(transactions: GenericTransaction[]): GenericTransaction[] {
  const usesSignedConvention = transactions.some(
    tx => isWithholdingTax(tx) && tx.total !== null && tx.total < 0
  )
  if (usesSignedConvention) {
    return transactions
  }

  return transactions.map(tx =>
    isWithholdingTax(tx) && tx.total !== null ? { ...tx, total: -Math.abs(tx.total) } : tx
  )
}

/**
 * Normalize a single generic row
 */
function normalizeGenericRow(
  row: RawCSVRow,
  fileId: string,
  rowIndex: number
): GenericTransaction | null {
  // Required fields
  const symbol = row['symbol']?.trim() || ''
  const dateStr = row['date']?.trim()
  const typeStr = row['type']?.trim()
  const currency = row['currency']?.trim() || 'USD'

  if (!dateStr || !typeStr) {
    return null // Skip rows with missing required fields
  }

  // Validate transaction type
  const type = parseGenericType(typeStr)
  if (!type) {
    return null
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
