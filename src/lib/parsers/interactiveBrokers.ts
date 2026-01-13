import { GenericTransaction, TransactionType } from '../../types/transaction'
import { RawCSVRow } from '../../types/broker'

/**
 * Transaction types from IB that represent actual trades (capital gains relevant)
 */
const TRADE_TYPES = new Set(['Buy', 'Sell', 'Assignment'])

/**
 * Transaction types from IB for interest (credit/debit)
 */
const INTEREST_TYPES = new Set(['Credit Interest', 'Debit Interest', 'Investment Interest Paid', 'Investment Interest Received'])

/**
 * Parse gross amount from IB row (handles column name with trailing space)
 */
function parseGrossAmount(row: RawCSVRow): number | null {
  const value = parseFloat(row['Gross Amount '] || row['Gross Amount'])
  return isNaN(value) ? null : value
}

/**
 * Create base transaction object with common fields
 */
function createBaseTransaction(
  fileId: string,
  rowIndex: number,
  baseCurrency: string,
  date: string,
  description: string | undefined
): Omit<GenericTransaction, 'type' | 'symbol' | 'quantity' | 'price' | 'total' | 'fee' | 'notes'> {
  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Interactive Brokers',
    name: description || null,
    date,
    currency: baseCurrency,
    ratio: null,
    incomplete: false,
    ignored: false,
  }
}

/**
 * Normalize Interactive Brokers CSV rows to GenericTransaction format
 *
 * IB Transaction History CSV has a multi-section format:
 * - First column: Section name (e.g., "Transaction History", "Statement", "Summary")
 * - Second column: Row type ("Header" or "Data")
 * - Variable columns per section
 *
 * We focus on the "Transaction History" section for buy/sell transactions
 *
 * @param rows Raw CSV rows
 * @param fileId Unique identifier for this file
 */
export function normalizeInteractiveBrokersTransactions(rows: RawCSVRow[], fileId: string): GenericTransaction[] {
  const transactions: GenericTransaction[] = []
  let rowIndex = 1

  // Extract base currency from Summary section if available
  const baseCurrency = extractBaseCurrency(rows)

  // After preprocessing, the CSV has proper column headers:
  // Section, RowType, Date, Account, Description, Transaction Type, Symbol, Quantity, Price, Gross Amount, Commission, Net Amount
  // Summary rows are included for base currency extraction, with extra columns padded

  for (const row of rows) {
    const sectionName = row['Section']
    const rowType = row['RowType']

    // Process only "Transaction History,Data" rows
    if (sectionName === 'Transaction History' && rowType === 'Data') {
      const normalized = normalizeIBTransactionHistoryRow(row, fileId, rowIndex, baseCurrency)
      if (normalized) {
        transactions.push(normalized)
        rowIndex++
      }
    }
  }

  return transactions
}

/**
 * Extract base currency from Summary section
 * Works with both preprocessed and raw formats
 */
function extractBaseCurrency(rows: RawCSVRow[]): string {
  for (const row of rows) {
    // Preprocessed format: Section, RowType columns
    const sectionName = row['Section']
    const rowType = row['RowType']

    // In preprocessed format, Summary rows have Date column containing "Base Currency"
    // because the columns are: Section, RowType, Date (which maps to Field Name for Summary rows)
    if (sectionName === 'Summary' && rowType === 'Data') {
      const fieldName = row['Date'] // Field Name is in the Date column position
      const fieldValue = row['Account'] // Field Value is in the Account column position
      if (fieldName === 'Base Currency') {
        return fieldValue || 'USD'
      }
    }
  }
  return 'USD'
}

/**
 * Normalize a single IB Transaction History row
 */
function normalizeIBTransactionHistoryRow(
  row: RawCSVRow,
  fileId: string,
  rowIndex: number,
  baseCurrency: string
): GenericTransaction | null {
  const transactionType = row['Transaction Type']?.trim()
  if (!transactionType) {
    return null
  }

  // Extract common fields
  const dateStr = row['Date']?.trim()
  const description = row['Description']?.trim()

  // Parse date (format: YYYY-MM-DD)
  const date = parseIBDate(dateStr)
  if (!date) {
    return null
  }

  // Handle trade transactions (Buy, Sell, Assignment)
  if (TRADE_TYPES.has(transactionType)) {
    return normalizeTradeRow(row, fileId, rowIndex, baseCurrency, transactionType, date, description)
  }

  // Handle dividend transactions
  if (transactionType === 'Dividend') {
    return normalizeDividendRow(row, fileId, rowIndex, baseCurrency, date, description)
  }

  // Handle interest transactions
  if (INTEREST_TYPES.has(transactionType)) {
    return normalizeInterestRow(row, fileId, rowIndex, baseCurrency, transactionType, date, description)
  }

  return null
}

/**
 * Normalize a trade row (Buy, Sell, Assignment)
 */
function normalizeTradeRow(
  row: RawCSVRow,
  fileId: string,
  rowIndex: number,
  baseCurrency: string,
  transactionType: string,
  date: string,
  description: string | undefined
): GenericTransaction | null {
  const symbol = row['Symbol']?.trim()

  if (!symbol || symbol === '-' || isBondSymbol(symbol)) {
    return null
  }

  // Quantity can be negative for sells
  const rawQuantity = parseFloat(row['Quantity']) || null
  const commission = Math.abs(parseFloat(row['Commission']) || 0)

  // In IB exports, Gross Amount is already in base currency. Derive price from it.
  const grossAmount = parseGrossAmount(row)
  const total = grossAmount !== null ? Math.abs(grossAmount) : null
  const quantity = rawQuantity !== null ? Math.abs(rawQuantity) : null
  const price = total !== null && quantity !== null && quantity > 0 ? total / quantity : null

  return {
    ...createBaseTransaction(fileId, rowIndex, baseCurrency, date, description),
    symbol,
    type: transactionType === 'Sell' ? TransactionType.SELL : TransactionType.BUY,
    quantity,
    price,
    total,
    fee: commission || null,
    notes: transactionType === 'Assignment' ? 'Options Assignment' : null,
  }
}

/**
 * Parse net amount from IB row (handles column name with trailing space)
 */
function parseNetAmount(row: RawCSVRow): number | null {
  const value = parseFloat(row['Net Amount '] || row['Net Amount'])
  return isNaN(value) ? null : value
}

/**
 * Normalize a dividend row
 *
 * IB provides:
 * - Gross Amount: dividend before withholding tax
 * - Net Amount: dividend after withholding tax
 * - Withholding = Gross - Net
 */
function normalizeDividendRow(
  row: RawCSVRow,
  fileId: string,
  rowIndex: number,
  baseCurrency: string,
  date: string,
  description: string | undefined
): GenericTransaction | null {
  const symbol = row['Symbol']?.trim()
  if (!symbol || symbol === '-') return null

  const grossAmount = parseGrossAmount(row)
  const netAmount = parseNetAmount(row)

  // Calculate withholding tax as difference between gross and net
  // If net is not available, withholding is null (no tax withheld or data unavailable)
  let withholdingTax: number | null = null
  if (grossAmount !== null && netAmount !== null) {
    const diff = Math.abs(grossAmount) - Math.abs(netAmount)
    // Only set withholding if there's a meaningful difference (> 0.001)
    withholdingTax = diff > 0.001 ? diff : null
  }

  // Use net amount as total if available, otherwise gross
  const total = netAmount !== null ? Math.abs(netAmount) : (grossAmount !== null ? Math.abs(grossAmount) : null)

  // Build notes
  const notes: string[] = []
  if (grossAmount !== null && withholdingTax !== null) {
    notes.push(`Gross: ${Math.abs(grossAmount).toFixed(2)} ${baseCurrency}, Tax withheld: ${withholdingTax.toFixed(2)} ${baseCurrency}`)
  }

  return {
    ...createBaseTransaction(fileId, rowIndex, baseCurrency, date, description),
    symbol,
    type: TransactionType.DIVIDEND,
    quantity: null,
    price: null,
    total,
    fee: null,
    notes: notes.length > 0 ? notes.join(', ') : null,
    // SA106 dividend withholding fields
    grossDividend: grossAmount !== null ? Math.abs(grossAmount) : null,
    withholdingTax,
  }
}

/**
 * Normalize an interest row (Credit Interest, Debit Interest, Investment Interest Paid)
 */
function normalizeInterestRow(
  row: RawCSVRow,
  fileId: string,
  rowIndex: number,
  baseCurrency: string,
  transactionType: string,
  date: string,
  description: string | undefined
): GenericTransaction | null {
  // Negative values indicate money paid out (debit interest)
  const isDebit = transactionType === 'Debit Interest' || transactionType === 'Investment Interest Paid'

  return {
    ...createBaseTransaction(fileId, rowIndex, baseCurrency, date, description),
    symbol: 'CASH', // Placeholder for interest transactions
    type: TransactionType.INTEREST,
    quantity: null,
    price: null,
    total: parseGrossAmount(row),
    fee: null,
    notes: isDebit ? 'Debit Interest' : 'Credit Interest',
  }
}

/**
 * Validate IB date format (YYYY-MM-DD) and return if valid
 */
function parseIBDate(dateStr: string | undefined): string | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  return dateStr
}

/**
 * Check if a symbol represents a bond
 * Bonds typically have spaces and contain fractions like "0 5/8" or maturity dates
 */
function isBondSymbol(symbol: string): boolean {
  // Bond symbols typically contain fractions (e.g., "0 5/8") or multiple spaces
  // Examples: "UKT 0 5/8 06/07/25"
  // Stock/options don't have fractions in their symbols
  if (symbol.includes('/') && symbol.includes(' ')) {
    return true
  }

  // Check for government bond patterns (e.g., "UKT 0" - government code followed by coupon rate)
  // These start with 2-3 letter government code, space, then a digit representing coupon
  // Options are different: "SQ    220916C00210000" - ticker, spaces, date+strike
  // Key difference: bonds have "UKT 0" pattern (code + single digit coupon), options have 6+ digit date codes
  if (/^[A-Z]{2,3}\s+\d\s/.test(symbol)) {
    return true
  }

  return false
}
