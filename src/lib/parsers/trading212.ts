import type { GenericTransaction } from '../../types/transaction'
import { TransactionType, TransactionTypeValue } from '../../types/transaction'
import { BrokerType, type RawCSVRow } from '../../types/broker'
import { parseISODate, parseNumber } from './parsingUtils'
import type { SkippedRow } from '../../types/brokerDefinition'

/**
 * Trading 212 CSV Parser
 *
 * Converts Trading 212 transaction exports to GenericTransaction format.
 *
 * Two export formats are supported. Columns are only included in an export
 * when relevant to the transactions in the selected date range.
 *
 * Expected columns (legacy format / newer format where renamed):
 * - Action: Transaction type (Market buy, Limit sell, Dividend, Deposit, etc.)
 * - Time / Time (UTC): Timestamp (YYYY-MM-DD HH:MM:SS, newer exports add a UTC offset)
 * - ISIN: Security identifier
 * - Ticker: Stock symbol
 * - Name: Company name
 * - No. of shares: Quantity
 * - Price / share: Unit price
 * - Currency (Price / share): Price currency. UK-listed securities are
 *   quoted in GBX (pence) and normalised to GBP by this parser.
 * - Exchange rate: FX rate to account currency
 * - Result: Profit/loss (for sales)
 * - Currency (Result): Result currency
 * - Total: Total value
 * - Currency (Total): Total currency
 * - Withholding tax: Tax withheld
 * - Currency (Withholding tax): Tax currency
 * - Transaction fee: Trading fee (legacy)
 * - Currency (Transaction fee): Fee currency (legacy)
 * - Stamp duty reserve tax: UK SDRT on purchases (newer format)
 * - Currency (Stamp duty reserve tax): SDRT currency (newer format)
 * - Currency conversion fee: FX fee
 * - Currency (Currency conversion fee): FX fee currency
 *   Fees are in the account currency, which can differ from the price
 *   currency: `fee_currency` records it when it does (see `rowFees`)
 * - Notes: Additional info
 * - ID: Unique transaction ID
 */

const HEADER_LOOKUPS = {
  time: ['Time', 'Time (UTC)'],
  quantity: ['No. of shares'],
  price: ['Price / share'],
  priceCurrency: ['Currency (Price / share)'],
  withholdingTax: ['Withholding tax'],
  withholdingTaxCurrency: ['Currency (Withholding tax)'],
} as const

function getRowValue(row: RawCSVRow, headers: readonly string[]): string | undefined {
  for (const header of headers) {
    const value = row[header]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return undefined
}

/**
 * Fee columns, each with its own `Currency (...)` column. Each is an
 * allowable cost (TCGA92/S38) and an export only includes the ones relevant
 * to its date range, so every populated one is summed.
 */
const FEE_COLUMNS = ['Transaction fee', 'Stamp duty reserve tax', 'Currency conversion fee'] as const

/**
 * The row's fees and the currency they are in.
 *
 * Trading 212 charges fees in the account currency (usually GBP), which can
 * differ from the price currency of the trade (e.g. a GBP conversion fee on
 * a USD buy), so the fee's currency is kept rather than assumed. A fee
 * column without its own currency is taken to be in the `Total` currency
 * (the account currency), then `fallbackCurrency`.
 *
 * Fees in more than one currency at once haven't been seen in an export.
 * If that happens, only the fees in the account currency are summed and
 * the rest are listed in `leftOut`, so nothing is added across currencies.
 */
function rowFees(row: RawCSVRow, fallbackCurrency: string): { fee: number; currency: string; leftOut: string[] } | null {
  const totalCurrency = row['Currency (Total)']?.trim().toUpperCase()
  const byCurrency = new Map<string, number>()
  for (const column of FEE_COLUMNS) {
    let amount = parseNumber(row[column])
    if (!amount) continue
    let currency = row[`Currency (${column})`]?.trim().toUpperCase() || totalCurrency || fallbackCurrency
    if (currency === 'GBX') {
      amount /= 100
      currency = 'GBP'
    }
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + amount)
  }
  if (byCurrency.size === 0) return null

  const currency = totalCurrency && byCurrency.has(totalCurrency) ? totalCurrency : [...byCurrency.keys()][0]
  const leftOut = [...byCurrency].filter(([c]) => c !== currency).map(([c, amount]) => `${amount} ${c}`)
  return { fee: byCurrency.get(currency)!, currency, leftOut }
}

/**
 * Exact match mappings for Trading 212 actions
 */
const EXACT_ACTION_MAP: Record<string, TransactionTypeValue> = {
  'deposit': TransactionType.TRANSFER,
  'withdrawal': TransactionType.TRANSFER,
  'stock split': TransactionType.STOCK_SPLIT,
  'result adjustment': TransactionType.FEE,
}

/**
 * Keyword-based mappings for Trading 212 actions (checked in order)
 */
const KEYWORD_ACTION_MAP: Array<{ keyword: string; type: TransactionTypeValue }> = [
  { keyword: 'buy', type: TransactionType.BUY },
  { keyword: 'sell', type: TransactionType.SELL },
  { keyword: 'dividend', type: TransactionType.DIVIDEND },
  { keyword: 'interest', type: TransactionType.INTEREST },
  { keyword: 'tax', type: TransactionType.TAX },
  { keyword: 'withholding', type: TransactionType.TAX },
]

/**
 * Map Trading 212 action to transaction type
 */
function mapActionToType(action: string): TransactionTypeValue {
  const actionLower = action.toLowerCase()

  // Check exact matches first
  if (actionLower in EXACT_ACTION_MAP) {
    return EXACT_ACTION_MAP[actionLower]
  }

  // Check keyword matches
  for (const { keyword, type } of KEYWORD_ACTION_MAP) {
    if (actionLower.includes(keyword)) {
      return type
    }
  }

  console.warn(`Unknown Trading 212 action: "${action}", marking as UNKNOWN`)
  return TransactionType.UNKNOWN
}

/**
 * Normalize Trading 212 transactions to GenericTransaction format
 */
export function normalizeTrading212Transactions(
  rows: RawCSVRow[],
  fileId: string,
  skippedRows?: SkippedRow[]
): GenericTransaction[] {
  return rows
    .map((row, index) => {
      const action = row['Action']
      const time = getRowValue(row, HEADER_LOOKUPS.time)
      const ticker = row['Ticker']
      const name = row['Name']

      // Skip rows without essential data
      if (!action || !time) return null

      // Times look like "2025-09-09 07:03:13"
      const date = parseISODate(time)
      if (!date) {
        // +2: spreadsheet row number (rows are 1-based and the header is row 1)
        skippedRows?.push({ row: index + 2, reason: `invalid date "${time}"` })
        return null
      }

      const type = mapActionToType(action)

      // Parse numeric fields
      const quantity = parseNumber(getRowValue(row, HEADER_LOOKUPS.quantity))
      const price = parseNumber(getRowValue(row, HEADER_LOOKUPS.price))
      const csvTotal = parseNumber(row['Total'])
      const withholdingTax = parseNumber(getRowValue(row, HEADER_LOOKUPS.withholdingTax))
      const exchangeRate = parseNumber(row['Exchange rate'])

      // Get currencies. Trading 212 quotes UK-listed securities in GBX
      // (pence), which must be normalised to GBP before FX enrichment.
      const priceCurrency = getRowValue(row, HEADER_LOOKUPS.priceCurrency)
      const totalCurrency = row['Currency (Total)']
      const isPenceQuoted = priceCurrency?.toUpperCase() === 'GBX'
      const normalizedPrice = isPenceQuoted && price !== undefined
        ? price / 100
        : price

      const isTrade = type === 'BUY' || type === 'SELL'

      // For BUY/SELL: Calculate total from price × quantity in the original currency
      // For others (DIVIDEND, INTEREST, TRANSFER): Use the CSV total (already in correct currency)
      let total: number | null
      if (isTrade) {
        // Calculate from price × quantity for buy/sell transactions
        total = normalizedPrice !== undefined && normalizedPrice !== null &&
                quantity !== undefined && quantity !== null
          ? normalizedPrice * quantity
          : null
      } else {
        // Use CSV total for non-trading transactions (dividends, interest, transfers)
        total = csvTotal ?? null
      }

      // GenericTransaction has a single `currency` field applied to price,
      // total, fee etc. alike during FX enrichment, so it must match
      // whichever figure is actually used as `total` above:
      // - Trades: `total` is computed from price × quantity, so it's in the
      //   price currency (GBX quotes normalise to GBP).
      // - Non-trades: `total` is the CSV `Total` column, which can be in a
      //   different currency than `Price / share` (e.g. a USD-quoted
      //   dividend credited as a GBP total) - so it must use `Currency (Total)`.
      const currency = isTrade
        ? (isPenceQuoted ? 'GBP' : priceCurrency || totalCurrency || 'GBP')
        : (totalCurrency || priceCurrency || 'GBP')

      const fees = rowFees(row, currency)

      const transaction: GenericTransaction = {
        id: `${fileId}-${index + 1}`,
        source: BrokerType.TRADING212,
        date,
        type,
        symbol: ticker || '',
        isin: row['ISIN']?.trim().toUpperCase() || null,
        name: name || null,
        quantity: quantity ?? null,
        price: normalizedPrice ?? null,
        currency,
        total,
        fee: fees?.fee ?? null,
        ...(fees && fees.currency !== currency && { fee_currency: fees.currency }),
        notes: row['Notes'] || null,
      }
      if (fees && fees.leftOut.length > 0) {
        const feeNote = `Fees in another currency left out: ${fees.leftOut.join(', ')}`
        transaction.notes = transaction.notes ? `${transaction.notes}; ${feeNote}` : feeNote
      }

      // For dividend transactions, calculate gross dividend and store withholding tax
      // Gross = Net (total) + Withholding Tax
      if (type === 'DIVIDEND') {
        const taxCurrency = getRowValue(row, HEADER_LOOKUPS.withholdingTaxCurrency) || currency

        // Withholding tax is deducted at source in the instrument's
        // currency, which can differ from `currency` (the CSV `Total`
        // column's currency, e.g. USD tax withheld on a dividend credited
        // as a GBP total). Convert it with the same `Exchange rate` that
        // turns an instrument-currency amount into the account-currency
        // total (see `currency` above) before combining it with `total` -
        // otherwise gross dividend would sum mismatched-currency figures
        // as if they were equal.
        const withholdingTaxInTxCurrency = withholdingTax !== undefined &&
          taxCurrency !== currency &&
          exchangeRate !== undefined
          ? withholdingTax * exchangeRate
          : withholdingTax

        // Calculate gross dividend: total (net) + withholding tax
        const grossDividend = withholdingTaxInTxCurrency && total !== null
          ? total + withholdingTaxInTxCurrency
          : total

        // Store in dedicated SA106 fields
        transaction.grossDividend = grossDividend
        transaction.withholdingTax = withholdingTaxInTxCurrency ?? null

        // Add withholding tax to notes for visibility (raw CSV figure and
        // its own currency, for audit trail)
        if (withholdingTax && withholdingTax > 0) {
          const taxNote = `Gross: ${grossDividend?.toFixed(2)} ${currency}, Tax withheld: ${withholdingTax} ${taxCurrency}`
          transaction.notes = transaction.notes
            ? `${transaction.notes}; ${taxNote}`
            : taxNote
        }
      } else if (withholdingTax && withholdingTax > 0) {
        // For non-dividend transactions with withholding tax, just add to notes
        const taxCurrency = getRowValue(row, HEADER_LOOKUPS.withholdingTaxCurrency) || currency
        const taxNote = `Withholding tax: ${withholdingTax} ${taxCurrency}`
        transaction.notes = transaction.notes
          ? `${transaction.notes}; ${taxNote}`
          : taxNote
      }

      return transaction
    })
    .filter((t): t is GenericTransaction => t !== null)
}
