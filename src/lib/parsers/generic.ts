import { GenericTransaction, TransactionType } from '../../types/transaction'
import { RawCSVRow } from '../../types/broker'
import { ColumnMapping } from '../../types/columnMapping'

/**
 * Normalize generic CSV rows using a column mapping
 * @param rows Raw CSV rows
 * @param mapping Column mapping configuration
 * @param fileId Unique identifier for this file
 */
export function normalizeGenericTransactions(
  rows: RawCSVRow[],
  mapping: ColumnMapping,
  fileId: string
): GenericTransaction[] {
  const transactions: GenericTransaction[] = []
  let rowIndex = 1

  for (const row of rows) {
    const normalized = normalizeGenericRow(row, mapping, fileId, rowIndex)
    if (normalized) {
      transactions.push(normalized)
      rowIndex++
    }
  }

  return transactions
}

/**
 * Normalize a single generic row using column mapping
 */
function normalizeGenericRow(
  row: RawCSVRow,
  mapping: ColumnMapping,
  fileId: string,
  rowIndex: number
): GenericTransaction | null {
  // Extract values based on mapping
  const dateStr = row[mapping.date]?.trim()
  const typeStr = row[mapping.type]?.trim()

  if (!dateStr || !typeStr) {
    return null // Skip rows with missing required fields
  }

  // Parse date (try to handle various formats)
  const date = parseGenericDate(dateStr)
  if (!date) {
    return null
  }

  // Parse transaction type
  const type = parseGenericType(typeStr)
  if (!type) {
    return null
  }

  // Extract optional fields
  const symbol = mapping.symbol ? (row[mapping.symbol]?.trim() || '') : ''
  const name = mapping.name ? (row[mapping.name]?.trim() || null) : null
  const quantity = mapping.quantity ? parseFloat(row[mapping.quantity]) || null : null
  const price = mapping.price ? parseGenericCurrency(row[mapping.price]) || null : null
  const currency = mapping.currency ? (row[mapping.currency]?.trim() || 'USD') : 'USD'
  const fee = mapping.fee ? parseGenericCurrency(row[mapping.fee]) || null : null
  const notes = mapping.notes ? (row[mapping.notes]?.trim() || null) : null

  // Calculate total
  let total: number | null = null
  if (mapping.total) {
    total = parseGenericCurrency(row[mapping.total]) || null
  }
  if (total === null && quantity !== null && price !== null) {
    total = quantity * price
  }

  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Generic CSV',
    symbol,
    name,
    date,
    type,
    quantity,
    price,
    currency,
    total: total !== null ? Math.abs(total) : null,
    fee,
    notes,
  }
}

/**
 * Parse generic date - tries multiple formats
 * Returns ISO date string (YYYY-MM-DD) or null
 */
function parseGenericDate(dateStr: string): string | null {
  if (!dateStr) return null

  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return dateStr.split('T')[0] // Handle ISO datetime
  }

  // Try US format (MM/DD/YYYY)
  const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (usMatch) {
    const [, month, day, year] = usMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // Try UK/EU format (DD/MM/YYYY)
  const ukMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (ukMatch) {
    const [, day, month, year] = ukMatch
    // Heuristic: if day > 12, it's definitely DD/MM/YYYY
    const parsedDay = parseInt(day)
    const parsedMonth = parseInt(month)
    if (parsedDay > 12) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    // Otherwise, assume US format (already handled above)
  }

  // Try dash format (YYYY-MM-DD or DD-MM-YYYY)
  const dashMatch = dateStr.match(/^(\d{1,4})-(\d{1,2})-(\d{1,4})/)
  if (dashMatch) {
    const [, first, month, third] = dashMatch
    if (first.length === 4) {
      // YYYY-MM-DD
      return `${first}-${month.padStart(2, '0')}-${third.padStart(2, '0')}`
    } else if (third.length === 4) {
      // DD-MM-YYYY
      return `${third}-${month.padStart(2, '0')}-${first.padStart(2, '0')}`
    }
  }

  return null
}

/**
 * Parse generic transaction type string to TransactionType
 */
function parseGenericType(typeStr: string): typeof TransactionType[keyof typeof TransactionType] | null {
  const typeLower = typeStr?.toLowerCase() || ''

  if (typeLower.includes('buy') || typeLower.includes('purchase')) {
    return TransactionType.BUY
  }
  if (typeLower.includes('sell') || typeLower.includes('sale')) {
    return TransactionType.SELL
  }
  if (typeLower.includes('dividend')) {
    return TransactionType.DIVIDEND
  }
  if (typeLower.includes('interest')) {
    return TransactionType.INTEREST
  }
  if (typeLower.includes('tax')) {
    return TransactionType.TAX
  }
  if (typeLower.includes('fee') || typeLower.includes('commission')) {
    return TransactionType.FEE
  }
  if (typeLower.includes('transfer') || typeLower.includes('wire') || typeLower.includes('deposit') || typeLower.includes('withdrawal')) {
    return TransactionType.TRANSFER
  }

  // Fallback to TRANSFER for unknown types
  return TransactionType.TRANSFER
}

/**
 * Parse generic currency value
 * Handles: $1,234.56, 1234.56, £1,234.56, €1.234,56
 */
function parseGenericCurrency(value: string): number | null {
  if (!value || value.trim() === '') return null

  // Remove currency symbols and spaces
  let cleaned = value.replace(/[$£€¥\s]/g, '')

  // Handle European format (1.234,56 -> 1234.56)
  if (cleaned.match(/\.\d{3},\d{2}$/)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    // Handle US/UK format (1,234.56 -> 1234.56)
    cleaned = cleaned.replace(/,/g, '')
  }

  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? null : parsed
}
