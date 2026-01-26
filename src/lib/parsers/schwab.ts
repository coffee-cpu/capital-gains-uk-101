import { GenericTransaction, TransactionType } from '../../types/transaction'
import { RawCSVRow } from '../../types/broker'
import { calculateTotal } from './parsingUtils'

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
 * For dividends with NRA Tax Adj (withholding tax):
 * - Schwab dividend amounts are GROSS (before tax)
 * - NRA Tax Adj amounts are the withholding tax (negative)
 * - Net = Gross - |Withholding|
 * 
 * @param rows Raw CSV rows
 * @param fileId Unique identifier for this file (e.g. 'schwab-abc123')
 */
export function normalizeSchwabTransactions(rows: RawCSVRow[], fileId: string): GenericTransaction[] {
  // First pass: collect NRA Tax Adj rows by symbol|date for linking to dividends
  const nraTaxAdjByKey = new Map<string, RawCSVRow>()
  
  for (const row of rows) {
    const action = row['Action']?.trim()?.toLowerCase()
    if (action === 'nra tax adj') {
      const symbol = row['Symbol']?.trim() || ''
      const date = parseSchwabDate(row['Date'])
      if (date) {
        const key = `${symbol}|${date}`
        nraTaxAdjByKey.set(key, row)
      }
    }
  }

  // Second pass: normalize all rows, linking NRA Tax Adj to dividends
  const transactions: GenericTransaction[] = []
  let rowIndex = 1

  for (const row of rows) {
    const action = row['Action']?.trim()?.toLowerCase()
    
    // Skip NRA Tax Adj rows - they will be merged into dividend transactions
    if (action === 'nra tax adj') {
      continue
    }
    
    const normalized = normalizeSchwabRow(row, fileId, rowIndex, nraTaxAdjByKey)
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
 * @param nraTaxAdjByKey Map of NRA Tax Adj rows keyed by "symbol|date" for linking to dividends
 */
function normalizeSchwabRow(
  row: RawCSVRow,
  fileId: string,
  rowIndex: number,
  nraTaxAdjByKey: Map<string, RawCSVRow>
): GenericTransaction | null {
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

  // Parse numeric values - use parseSchwabQuantity to handle commas
  const quantity = parseSchwabQuantity(row['Quantity'])
  const price = parseSchwabCurrency(row['Price']) || null
  const fee = parseSchwabCurrency(row['Fees & Comm']) || null
  const amount = parseSchwabCurrency(row['Amount']) || null

  // Calculate total (for buys, amount is negative, for sells positive)
  const total = calculateTotal(amount, quantity, price)

  // For dividend transactions, link to NRA Tax Adj if present
  // Schwab dividend amounts are GROSS (before tax)
  // NRA Tax Adj amounts are the withholding tax (negative)
  let grossDividend: number | null = null
  let withholdingTax: number | null = null
  let netTotal = total
  
  const isDividend = type === TransactionType.DIVIDEND
  if (isDividend && symbol && date) {
    const key = `${symbol}|${date}`
    const nraTaxRow = nraTaxAdjByKey.get(key)
    
    if (nraTaxRow) {
      // Schwab amount is GROSS dividend
      grossDividend = amount !== null ? Math.abs(amount) : null
      
      // NRA Tax Adj amount is withholding tax (stored as negative)
      const nraTaxAmount = parseSchwabCurrency(nraTaxRow['Amount'])
      withholdingTax = nraTaxAmount !== null ? Math.abs(nraTaxAmount) : null
      
      // Net = Gross - Withholding
      if (grossDividend !== null && withholdingTax !== null) {
        netTotal = grossDividend - withholdingTax
      }
    } else {
      // No NRA Tax Adj - dividend amount is both gross and net
      grossDividend = amount !== null ? Math.abs(amount) : null
    }
  }

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
    total: isDividend ? netTotal : total, // Use net for dividends
    fee,
    ratio,
    notes: isIncompleteStockPlanActivity
      ? 'Stock Plan Activity - ignored in favor of Equity Awards data. Upload Charles Schwab Equity Awards file for complete information.'
      : isStockPlanActivity
        ? 'Stock Plan Activity'
        : withholdingTax !== null
          ? `Gross dividend: $${grossDividend?.toFixed(2)}, Tax withheld: $${withholdingTax.toFixed(2)}`
          : null,
    incomplete: isIncompleteStockPlanActivity,
    ignored: isIncompleteStockPlanActivity, // Ignore Stock Plan Activity without price
    is_short_sell: isShortSell || undefined,
    // Dividend withholding fields (for SA106 reporting)
    ...(isDividend && {
      grossDividend,
      withholdingTax,
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
  } else if (actionLower.includes('dividend') || actionLower === 'nra tax adj') {
    // NRA Tax Adj is withholding tax on dividends - treat as negative dividend
    // so it reduces total dividend earnings when summed
    type = TransactionType.DIVIDEND
  } else if (actionLower.includes('interest')) {
    type = TransactionType.INTEREST
  } else if (actionLower.includes('tax') || actionLower.includes('withholding')) {
    type = TransactionType.TAX
  } else if (actionLower.includes('wire') || actionLower.includes('transfer') || actionLower === 'journal' || actionLower === 'moneylink transfer') {
    type = TransactionType.TRANSFER
  } else if (actionLower.includes('fee') || actionLower === 'misc cash entry') {
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

/**
 * Parse quantity that may contain commas (e.g., "1,000" -> 1000)
 * Also handles negative quantities
 */
function parseSchwabQuantity(value: string): number | null {
  if (!value || value.trim() === '') return null

  // Remove commas and parse
  const cleaned = value.replace(/,/g, '')
  const parsed = parseFloat(cleaned)

  return isNaN(parsed) ? null : parsed
}
