import { GenericTransaction, TransactionType } from '../../types/transaction'
import { RawCSVRow } from '../../types/broker'
import { CSVPreprocessor, readFileHead } from './fileUtils'

/**
 * Raw-file preprocessor for Interactive Brokers' multi-section CSV format.
 * Registered in `csvParser.ts`.
 */
export const ibCSVPreprocessor: CSVPreprocessor = {
  async matches(file: File): Promise<boolean> {
    const text = await readFileHead(file, 2000)
    if (!text) return false
    const hasStatement = text.includes('Statement,Header,') || text.includes('Statement,Data,')
    const hasTransactionHistory =
      text.includes('Transaction History,Header,') || text.includes('Transaction History,Data,')
    return hasStatement && hasTransactionHistory
  },
  apply: preprocessInteractiveBrokersCSV,
}

/**
 * Preprocess Interactive Brokers CSV to handle its multi-section format
 *
 * IB CSVs have multiple sections with different column counts:
 * - Statement: 4 columns (Statement,Header/Data,Field Name,Field Value)
 * - Summary: 4 columns (Summary,Header/Data,Field Name,Field Value)
 * - Transaction History: 11+ columns
 *
 * We extract the Transaction History header and promote it to the CSV's single header row,
 * then include Summary data rows (padded to match the header width so base currency can be
 * extracted downstream) alongside Transaction History data rows.
 */
export async function preprocessInteractiveBrokersCSV(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) {
        reject(new Error('Failed to read file'))
        return
      }

      const lines = text.split('\n')
      let headerRow: string | null = null
      const summaryRows: string[] = []
      const transactionRows: string[] = []

      for (const line of lines) {
        if (!line.trim()) continue

        // Parse the line to extract section name and row type
        // Use a simple regex since we just need the first two columns
        const match = line.match(/^([^,]+),([^,]+),(.*)$/)
        if (!match) {
          continue
        }

        const sectionName = match[1]
        const rowType = match[2]
        const restOfLine = match[3]

        if (rowType === 'Header') {
          // Store the header for Transaction History section
          if (sectionName === 'Transaction History') {
            // Create header row with Section and RowType columns prepended
            headerRow = `Section,RowType,${restOfLine}`
          }
        } else if (rowType === 'Data') {
          // Collect data rows for Transaction History section
          if (sectionName === 'Transaction History') {
            transactionRows.push(`${sectionName},${rowType},${restOfLine}`)
          } else if (sectionName === 'Summary') {
            // Also include Summary section for base currency extraction
            // Pad with empty columns to match Transaction History column count
            summaryRows.push(`${sectionName},${rowType},${restOfLine},,,,,,,,,`)
          }
        }
      }

      if (!headerRow) {
        reject(new Error('Could not find Transaction History header in Interactive Brokers CSV'))
        return
      }

      // Build the final CSV with header FIRST, then Summary rows, then Transaction History rows
      const processedRows = [headerRow, ...summaryRows, ...transactionRows]

      if (processedRows.length <= 1) {
        reject(new Error('Could not find Transaction History data in Interactive Brokers CSV'))
        return
      }

      const processedCsv = processedRows.join('\n')
      const processedFile = new File([processedCsv], file.name, { type: file.type })
      resolve(processedFile)
    }
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    reader.readAsText(file)
  })
}

/**
 * Transaction types from IB that represent actual trades (capital gains relevant)
 */
const TRADE_TYPES = new Set(['Buy', 'Sell', 'Assignment'])

/**
 * Transaction types from IB for interest (credit/debit)
 */
const INTEREST_TYPES = new Set(['Credit Interest', 'Debit Interest', 'Investment Interest Paid', 'Investment Interest Received'])

/**
 * Transaction types from IB for transfers (deposits/withdrawals, FX conversions)
 */
const TRANSFER_TYPES = new Set(['Deposit', 'Withdrawal', 'Transfer', 'Forex Trade Component'])

/**
 * Transaction types from IB for fees (subscriptions, withdrawal fees, FX adjustments)
 */
const FEE_TYPES = new Set(['Other Fee', 'Adjustment'])

/**
 * Transaction types from IB for taxes (VAT on subscriptions)
 */
const TAX_TYPES = new Set(['Sales Tax'])

/**
 * Parsed options symbol components
 */
interface ParsedIBOptionsSymbol {
  underlying: string
  expirationDate: string // YYYY-MM-DD
  strikePrice: number
  optionType: 'CALL' | 'PUT'
}

/**
 * Check if an IB symbol represents an options contract
 * IB format: SYMBOL<spaces>YYMMDDX######## (e.g., "GLD   270115C00580000")
 */
function isIBOptionsSymbol(symbol: string): boolean {
  return /^[A-Z]+\s+\d{6}[CP]\d{8}$/.test(symbol)
}

/**
 * Parse IB options symbol format
 * Example: "GLD   270115C00580000" → { underlying: "GLD", expirationDate: "2027-01-15", strikePrice: 580, optionType: "CALL" }
 */
function parseIBOptionsSymbol(symbol: string): ParsedIBOptionsSymbol | null {
  const match = symbol.match(/^([A-Z]+)\s+(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/)
  if (!match) return null

  const [, underlying, yy, mm, dd, typeChar, strikeStr] = match
  return {
    underlying,
    expirationDate: `20${yy}-${mm}-${dd}`,
    strikePrice: parseInt(strikeStr, 10) / 1000,
    optionType: typeChar === 'C' ? 'CALL' : 'PUT',
  }
}

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
 * @param referenceDate Optional reference date (YYYY-MM-DD) for synthetic expiration injection. Defaults to today.
 */
export function normalizeInteractiveBrokersTransactions(
  rows: RawCSVRow[],
  fileId: string,
  referenceDate?: string
): GenericTransaction[] {
  const transactions: GenericTransaction[] = []
  let rowIndex = 1

  // Extract base currency from Summary section if available
  const baseCurrency = extractBaseCurrency(rows)

  // Collect Transaction History data rows and sort by date (IB CSVs are reverse chronological)
  const dataRows = rows.filter(
    row => row['Section'] === 'Transaction History' && row['RowType'] === 'Data'
  )
  dataRows.sort((a, b) => (a['Date'] || '').localeCompare(b['Date'] || ''))

  // Track net options positions for synthetic expiration injection
  const optionsPositions = new Map<string, number>()

  for (const row of dataRows) {
    const normalized = normalizeIBTransactionHistoryRow(row, fileId, rowIndex, baseCurrency, optionsPositions)
    if (normalized) {
      transactions.push(normalized)
      rowIndex++
    }
  }

  // Inject synthetic OPTIONS_EXPIRED for options with remaining positions past expiration
  const today = referenceDate ?? new Date().toISOString().split('T')[0]
  for (const [symbol, netPosition] of optionsPositions) {
    if (netPosition === 0) continue

    const parsed = parseIBOptionsSymbol(symbol)
    if (!parsed || parsed.expirationDate > today) continue

    // Position still open past expiration — inject synthetic expiration
    const absQty = Math.abs(netPosition)
    transactions.push({
      id: `${fileId}-exp-${rowIndex}`,
      source: 'Interactive Brokers',
      name: `${parsed.underlying} ${parsed.optionType} $${parsed.strikePrice} expired`,
      date: parsed.expirationDate,
      currency: baseCurrency,
      ratio: null,
      incomplete: false,
      ignored: false,
      symbol,
      type: TransactionType.OPTIONS_EXPIRED,
      // Negative qty for long positions (disposal), positive for short (acquisition)
      quantity: netPosition > 0 ? -absQty : absQty,
      price: 0,
      total: 0,
      fee: null,
      notes: 'Synthetic: assumed expired (no closing activity found)',
      underlying_symbol: parsed.underlying,
      option_type: parsed.optionType,
      strike_price: parsed.strikePrice,
      expiration_date: parsed.expirationDate,
      // IB amounts already include the 100-share contract multiplier, so don't set contract_size
    })
    rowIndex++
  }

  // Sort final list by date
  transactions.sort((a, b) => a.date.localeCompare(b.date))

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
  baseCurrency: string,
  optionsPositions: Map<string, number>
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
    return normalizeTradeRow(row, fileId, rowIndex, baseCurrency, transactionType, date, description, optionsPositions)
  }

  // Handle dividend transactions
  if (transactionType === 'Dividend') {
    return normalizeDividendRow(row, fileId, rowIndex, baseCurrency, date, description)
  }

  // Handle interest transactions
  if (INTEREST_TYPES.has(transactionType)) {
    return normalizeInterestRow(row, fileId, rowIndex, baseCurrency, transactionType, date, description)
  }

  // Handle foreign tax withholding (tax on dividends)
  if (transactionType === 'Foreign Tax Withholding') {
    const symbol = row['Symbol']?.trim()
    return {
      ...createBaseTransaction(fileId, rowIndex, baseCurrency, date, description),
      symbol: (symbol && symbol !== '-') ? symbol : 'CASH',
      type: TransactionType.TAX_ON_DIVIDEND,
      quantity: null,
      price: null,
      total: parseGrossAmount(row),
      fee: null,
      notes: 'Foreign Tax Withholding',
    }
  }

  // Handle fee transactions (subscription fees, withdrawal fees, FX adjustments)
  if (FEE_TYPES.has(transactionType)) {
    const symbol = row['Symbol']?.trim()
    return {
      ...createBaseTransaction(fileId, rowIndex, baseCurrency, date, description),
      symbol: (symbol && symbol !== '-') ? symbol : 'CASH',
      type: TransactionType.FEE,
      quantity: null,
      price: null,
      total: parseGrossAmount(row),
      fee: null,
      notes: transactionType,
    }
  }

  // Handle tax transactions (VAT on subscriptions)
  if (TAX_TYPES.has(transactionType)) {
    return {
      ...createBaseTransaction(fileId, rowIndex, baseCurrency, date, description),
      symbol: 'CASH',
      type: TransactionType.TAX,
      quantity: null,
      price: null,
      total: parseGrossAmount(row),
      fee: null,
      notes: transactionType,
    }
  }

  // Handle transfer transactions (deposits, withdrawals, FX conversions)
  if (TRANSFER_TYPES.has(transactionType)) {
    const symbol = row['Symbol']?.trim()
    return {
      ...createBaseTransaction(fileId, rowIndex, baseCurrency, date, description),
      symbol: (symbol && symbol !== '-') ? symbol : 'CASH',
      type: TransactionType.TRANSFER,
      quantity: null,
      price: null,
      total: parseGrossAmount(row),
      fee: null,
      notes: transactionType,
    }
  }

  // Return UNKNOWN for unrecognized transaction types
  console.warn(`Unknown Interactive Brokers transaction type: "${transactionType}", marking as UNKNOWN`)
  const symbol = row['Symbol']?.trim() || ''
  return {
    ...createBaseTransaction(fileId, rowIndex, baseCurrency, date, description),
    symbol,
    type: TransactionType.UNKNOWN,
    quantity: null,
    price: null,
    total: parseGrossAmount(row),
    fee: null,
    notes: `Unrecognized transaction type: ${transactionType}`,
  }
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
  description: string | undefined,
  optionsPositions: Map<string, number>
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

  // Check if this is an options trade
  if (isIBOptionsSymbol(symbol)) {
    const parsed = parseIBOptionsSymbol(symbol)
    if (!parsed) return null

    // Guard against misclassification: Assignment has no quantity column in IB exports,
    // but Buy/Sell rows with unparseable quantity would otherwise fall into the selling branch below
    if (rawQuantity === null && transactionType !== 'Assignment') return null

    // Determine options transaction type using position tracking
    const currentPosition = optionsPositions.get(symbol) || 0
    let type: typeof TransactionType[keyof typeof TransactionType]

    if (transactionType === 'Assignment') {
      type = TransactionType.OPTIONS_ASSIGNED
    } else if (rawQuantity !== null && rawQuantity > 0) {
      // Buying: if we're short, this closes; otherwise opens
      type = currentPosition < 0 ? TransactionType.OPTIONS_BUY_TO_CLOSE : TransactionType.OPTIONS_BUY_TO_OPEN
    } else {
      // Selling: if we're long, this closes; otherwise opens
      type = currentPosition > 0 ? TransactionType.OPTIONS_SELL_TO_CLOSE : TransactionType.OPTIONS_SELL_TO_OPEN
    }

    // Update position tracking (rawQuantity is positive for buys, negative for sells)
    if (rawQuantity !== null) {
      optionsPositions.set(symbol, currentPosition + rawQuantity)
    }

    return {
      ...createBaseTransaction(fileId, rowIndex, baseCurrency, date, description),
      symbol,
      type,
      quantity,
      price,
      total,
      fee: commission || null,
      notes: transactionType === 'Assignment' ? 'Options Assignment' : null,
      underlying_symbol: parsed.underlying,
      option_type: parsed.optionType,
      strike_price: parsed.strikePrice,
      expiration_date: parsed.expirationDate,
      // IB Gross Amount already includes the 100-share contract multiplier, so don't set contract_size
    }
  }

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
