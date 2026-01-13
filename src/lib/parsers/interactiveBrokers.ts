import { GenericTransaction, TransactionType } from '../../types/transaction'
import { RawCSVRow } from '../../types/broker'

/**
 * Transaction types from IB that represent actual trades (capital gains relevant)
 */
const TRADE_TRANSACTION_TYPES = ['Buy', 'Sell', 'Assignment']

/**
 * Transaction types from IB for dividends and interest
 */
const DIVIDEND_TRANSACTION_TYPES = ['Dividend']
const INTEREST_TRANSACTION_TYPES = ['Credit Interest', 'Debit Interest', 'Investment Interest Paid', 'Investment Interest Received']

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
  if (TRADE_TRANSACTION_TYPES.includes(transactionType)) {
    return normalizeTradeRow(row, fileId, rowIndex, baseCurrency, transactionType, date, description)
  }

  // Handle dividend transactions
  if (DIVIDEND_TRANSACTION_TYPES.includes(transactionType)) {
    return normalizeDividendRow(row, fileId, rowIndex, baseCurrency, date, description)
  }

  // Handle interest transactions
  if (INTEREST_TRANSACTION_TYPES.includes(transactionType)) {
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

  if (!symbol || symbol === '-') {
    return null // Skip invalid rows or rows with no symbol
  }

  // Skip bonds (symbols like "UKT 0 5/8 06/07/25" contain spaces and fractions)
  if (isBondSymbol(symbol)) {
    return null
  }

  // Parse numeric values
  // Quantity can be negative for sells
  const rawQuantity = parseFloat(row['Quantity']) || null
  const commission = Math.abs(parseFloat(row['Commission']) || 0)

  // IMPORTANT: In IB exports, Price is in the original transaction currency,
  // but Gross Amount and Net Amount are already converted to the base currency (e.g., GBP).
  // We use Gross Amount directly as the total, and derive the price from it.
  const grossAmount = parseFloat(row['Gross Amount '] || row['Gross Amount']) || null

  // Calculate total from gross amount (make positive)
  const total = grossAmount !== null ? Math.abs(grossAmount) : null

  // Derive price in base currency from gross amount / quantity
  let price: number | null = null
  if (total !== null && rawQuantity !== null && Math.abs(rawQuantity) > 0) {
    price = total / Math.abs(rawQuantity)
  }

  // Determine transaction type
  let type: (typeof TransactionType)[keyof typeof TransactionType]
  if (transactionType === 'Sell') {
    type = TransactionType.SELL
  } else {
    type = TransactionType.BUY
  }

  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Interactive Brokers',
    symbol: symbol,
    name: description || null,
    date,
    type,
    quantity: rawQuantity !== null ? Math.abs(rawQuantity) : null,
    price,
    currency: baseCurrency,
    total,
    fee: commission || null,
    ratio: null,
    notes: transactionType === 'Assignment' ? 'Options Assignment' : null,
    incomplete: false,
    ignored: false,
  }
}

/**
 * Normalize a dividend row
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

  if (!symbol || symbol === '-') {
    return null
  }

  const grossAmount = parseFloat(row['Gross Amount '] || row['Gross Amount']) || null
  const total = grossAmount !== null ? Math.abs(grossAmount) : null

  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Interactive Brokers',
    symbol: symbol,
    name: description || null,
    date,
    type: TransactionType.DIVIDEND,
    quantity: null,
    price: null,
    currency: baseCurrency,
    total,
    fee: null,
    ratio: null,
    notes: null,
    incomplete: false,
    ignored: false,
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
  // Interest transactions typically don't have a symbol
  // Use "CASH" as a placeholder symbol for interest transactions
  const symbol = 'CASH'

  const grossAmount = parseFloat(row['Gross Amount '] || row['Gross Amount']) || null

  // Interest types:
  // - Credit Interest: positive (income received)
  // - Debit Interest: negative (paid to broker for margin)
  // - Investment Interest Paid: negative (paid to seller for bonds)
  // We preserve the value as-is since negative values indicate money paid out
  const total = grossAmount

  // Determine if it's credit or debit interest for notes
  const isDebit = transactionType === 'Debit Interest' || transactionType === 'Investment Interest Paid'
  const notes = isDebit ? 'Debit Interest' : 'Credit Interest'

  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Interactive Brokers',
    symbol: symbol,
    name: description || null,
    date,
    type: TransactionType.INTEREST,
    quantity: null,
    price: null,
    currency: baseCurrency,
    total,
    fee: null,
    ratio: null,
    notes,
    incomplete: false,
    ignored: false,
  }
}

/**
 * Parse IB date format: "YYYY-MM-DD"
 * Returns ISO date string (YYYY-MM-DD) or null
 */
function parseIBDate(dateStr: string): string | null {
  if (!dateStr) return null

  // Validate ISO date format
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

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
