import { GenericTransaction, TransactionType } from '../../types/transaction'
import { RawCSVRow } from '../../types/broker'
import { calculateTotal, parseCurrency, parseUSDate } from './parsingUtils'

/**
 * Parsed options symbol data
 */
interface ParsedOptionsSymbol {
  underlying: string
  expirationDate: string // YYYY-MM-DD format
  strikePrice: number
  optionType: 'CALL' | 'PUT'
}

/**
 * Normalize Schwab CSV rows to GenericTransaction format
 *
 * NRA Tax Adj rows are emitted as typed TAX_ON_DIVIDEND or TAX_ON_INTEREST
 * transactions (visible in UI). The CGT engine sums these for withholding totals.
 *
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
 * Check if a transaction type is an options transaction
 */
function isOptionsTransaction(type: typeof TransactionType[keyof typeof TransactionType]): boolean {
  const optionsTypes: string[] = [
    TransactionType.OPTIONS_BUY_TO_OPEN,
    TransactionType.OPTIONS_SELL_TO_OPEN,
    TransactionType.OPTIONS_BUY_TO_CLOSE,
    TransactionType.OPTIONS_SELL_TO_CLOSE,
    TransactionType.OPTIONS_ASSIGNED,
    TransactionType.OPTIONS_EXPIRED,
    TransactionType.OPTIONS_STOCK_SPLIT,
  ]
  return optionsTypes.includes(type)
}

/**
 * Normalize a single Schwab row
 *
 * @param row The CSV row to normalize
 * @param fileId Unique file identifier
 * @param rowIndex Row index for generating unique ID
 */
function normalizeSchwabRow(
  row: RawCSVRow,
  fileId: string,
  rowIndex: number,
): GenericTransaction | null {
  const action = row['Action']?.trim()
  const symbol = row['Symbol']?.trim()
  const date = parseSchwabDate(row['Date'])

  if (!date) {
    return null // Skip rows with invalid dates
  }

  // Map Schwab action to transaction type
  let { type, isShortSell } = mapSchwabAction(action)
  if (!type) {
    return null // Skip unknown actions for now
  }

  // NRA Tax Adj: use typed sub-type based on whether symbol is present
  // With symbol → withholding tax on a specific stock's dividend
  // Without symbol → withholding tax on interest (interest has no symbol)
  if (action?.toLowerCase() === 'nra tax adj') {
    type = symbol ? TransactionType.TAX_ON_DIVIDEND : TransactionType.TAX_ON_INTEREST
  }

  // Parse numeric values
  const quantity = parseCurrency(row['Quantity'])
  const price = parseCurrency(row['Price']) || null
  const fee = parseCurrency(row['Fees & Comm']) || null
  const amount = parseCurrency(row['Amount']) || null

  // Calculate total (for buys, amount is negative, for sells positive)
  const total = calculateTotal(amount, quantity, price)

  const isDividend = type === TransactionType.DIVIDEND
  const isNraTaxAdj = action?.toLowerCase() === 'nra tax adj'

  // For dividends, Schwab amount IS the gross dividend
  const grossDividend = isDividend && amount !== null ? Math.abs(amount) : null

  // Check if this is Stock Plan Activity
  const isStockPlanActivity = action?.toLowerCase() === 'stock plan activity'
  // Without price, it's incomplete and should be ignored
  // Users should use Charles Schwab Equity Awards data instead, which has complete information
  // However, if user manually added price to the CSV, treat it as complete
  const isIncompleteStockPlanActivity = isStockPlanActivity && price === null

  // Extract split ratio for STOCK_SPLIT transactions
  const ratio = type === TransactionType.STOCK_SPLIT
    ? parseSchwabStockSplitRatio(row['Description'])
    : null

  // Check if this is an options transaction and parse options-specific fields
  const isOptions = isOptionsTransaction(type)
  let optionsData: {
    underlying_symbol: string | null
    option_type: 'CALL' | 'PUT' | null
    strike_price: number | null
    expiration_date: string | null
    contract_size: number | null
  } | null = null

  if (isOptions && symbol && isOptionsSymbol(symbol)) {
    const parsed = parseOptionsSymbol(symbol)
    if (parsed) {
      optionsData = {
        underlying_symbol: parsed.underlying,
        option_type: parsed.optionType,
        strike_price: parsed.strikePrice,
        expiration_date: parsed.expirationDate,
        contract_size: 100, // Standard US options contract size
      }
    }
  }

  // For options transactions, use the full options symbol (e.g., "GOOGL 01/16/2026 160.00 C")
  // This ensures each unique option contract has its own Section 104 pool
  // The underlying_symbol field can be used for grouping by underlying stock
  const effectiveSymbol = symbol || ''

  // For options, store the full options symbol in the name if description is not available
  const effectiveName = row['Description']?.trim() || (isOptions && symbol ? symbol : null)

  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Charles Schwab',
    symbol: effectiveSymbol,
    name: effectiveName,
    date,
    type,
    quantity,
    price,
    currency: 'USD', // Schwab reports in USD
    total,
    fee,
    ratio,
    notes: isIncompleteStockPlanActivity
      ? 'Stock Plan Activity - ignored in favor of Equity Awards data. Upload Charles Schwab Equity Awards file for complete information.'
      : isStockPlanActivity
        ? 'Stock Plan Activity'
        : isNraTaxAdj
          ? 'NRA Tax Adj'
          : null,
    incomplete: isIncompleteStockPlanActivity,
    ignored: isIncompleteStockPlanActivity, // Ignore Stock Plan Activity without price
    is_short_sell: isShortSell || undefined,
    // Dividend withholding fields (for SA106 reporting)
    // withholdingTax is set directly by parsers that support it (IB, Freetrade)
    ...(isDividend && {
      grossDividend,
    }),
    // Options-specific fields
    ...(optionsData && {
      underlying_symbol: optionsData.underlying_symbol,
      option_type: optionsData.option_type,
      strike_price: optionsData.strike_price,
      expiration_date: optionsData.expiration_date,
      contract_size: optionsData.contract_size,
    }),
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

  // Determine if this is a short sell action
  const isShortSell = actionLower === 'sell short' || actionLower === 'sell to open'

  let type: typeof TransactionType[keyof typeof TransactionType]

  // Options trading actions
  if (actionLower === 'buy to open') {
    type = TransactionType.OPTIONS_BUY_TO_OPEN
  } else if (actionLower === 'sell to open') {
    type = TransactionType.OPTIONS_SELL_TO_OPEN
  } else if (actionLower === 'buy to close') {
    type = TransactionType.OPTIONS_BUY_TO_CLOSE
  } else if (actionLower === 'sell to close') {
    type = TransactionType.OPTIONS_SELL_TO_CLOSE
  } else if (actionLower === 'assigned') {
    type = TransactionType.OPTIONS_ASSIGNED
  } else if (actionLower === 'expired') {
    type = TransactionType.OPTIONS_EXPIRED
  } else if (actionLower === 'options frwd split' || actionLower === 'options frwd split adj') {
    type = TransactionType.OPTIONS_STOCK_SPLIT
  // Regular stock actions
  } else if (actionLower === 'buy' || actionLower === 'stock plan activity') {
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
  } else if (actionLower.includes('wire') || actionLower.includes('transfer') || actionLower === 'journal' || actionLower === 'moneylink transfer') {
    type = TransactionType.TRANSFER
  } else if (actionLower.includes('fee') || actionLower === 'misc cash entry') {
    type = TransactionType.FEE
  } else {
    // Return UNKNOWN for unrecognized actions so users can see them and report issues
    console.warn(`Unknown Schwab action: "${action}", marking as UNKNOWN`)
    type = TransactionType.UNKNOWN
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
  return parseUSDate(parts.length > 1 ? parts[1] : parts[0])
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

/**
 * Check if a symbol is an options symbol
 * Options symbols contain a date pattern and end with C or P
 * Examples:
 *   "GOOGL 01/16/2026 160.00 C" -> true
 *   "APP 02/28/2025 400.00 P" -> true
 *   "GOOGL" -> false
 *   "AAPL" -> false
 */
export function isOptionsSymbol(symbol: string): boolean {
  if (!symbol) return false
  // Match pattern: SYMBOL MM/DD/YYYY STRIKE C/P
  const optionsPattern = /^[A-Z]+\s+\d{2}\/\d{2}\/\d{4}\s+[\d.]+\s+[CP]$/
  return optionsPattern.test(symbol.trim())
}

/**
 * Parse options symbol format: "SYMBOL MM/DD/YYYY STRIKE.00 C/P"
 * Examples:
 *   "GOOGL 01/16/2026 160.00 C" -> { underlying: "GOOGL", expirationDate: "2026-01-16", strikePrice: 160.00, optionType: "CALL" }
 *   "APP 02/28/2025 400.00 P" -> { underlying: "APP", expirationDate: "2025-02-28", strikePrice: 400.00, optionType: "PUT" }
 * Returns null if not a valid options symbol
 */
export function parseOptionsSymbol(symbol: string): ParsedOptionsSymbol | null {
  if (!symbol) return null

  // Match pattern: SYMBOL MM/DD/YYYY STRIKE C/P
  const match = symbol.trim().match(/^([A-Z]+)\s+(\d{2})\/(\d{2})\/(\d{4})\s+([\d.]+)\s+([CP])$/)
  if (!match) return null

  const [, underlying, month, day, year, strikeStr, typeChar] = match

  return {
    underlying,
    expirationDate: `${year}-${month}-${day}`,
    strikePrice: parseFloat(strikeStr),
    optionType: typeChar === 'C' ? 'CALL' : 'PUT',
  }
}

