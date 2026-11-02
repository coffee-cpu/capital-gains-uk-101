import { GenericTransaction, TransactionType } from '../../types/transaction'
import { RawCSVRow } from '../../types/broker'
import { parseUSDate, parseCurrency, parseNumber } from './parsingUtils'

/**
 * Normalize Schwab Equity Awards CSV rows to GenericTransaction format
 *
 * Each transaction row (it has a Date) is followed by zero or more detail rows
 * (Date empty). A Lapse has one detail row; a Dividend or Wire Transfer has
 * none; a Sale can have several. Rows are grouped by that rule rather than
 * read as fixed pairs, so a row without details can't shift every later pair
 * and silently drop vests.
 *
 * @param rows Raw CSV rows
 * @param fileId Unique identifier for this file
 */
export function normalizeSchwabEquityAwardsTransactions(rows: RawCSVRow[], fileId: string): GenericTransaction[] {
  const transactions: GenericTransaction[] = []
  let rowIndex = 1

  for (const group of groupTransactionRows(rows)) {
    const normalized = normalizeSchwabEquityAwardsPair(group.transactionRow, group.detailRows, fileId, rowIndex)
    if (normalized) {
      transactions.push(normalized)
      rowIndex++
    }
  }

  return transactions
}

/**
 * Group each transaction row with the detail rows that follow it
 */
function groupTransactionRows(rows: RawCSVRow[]): { transactionRow: RawCSVRow; detailRows: RawCSVRow[] }[] {
  const groups: { transactionRow: RawCSVRow; detailRows: RawCSVRow[] }[] = []
  for (const row of rows) {
    if (row['Date']?.trim()) {
      groups.push({ transactionRow: row, detailRows: [] })
    } else if (groups.length > 0) {
      groups[groups.length - 1].detailRows.push(row)
    }
  }
  return groups
}

/**
 * Normalize a Schwab Equity Awards transaction row with its detail rows
 */
function normalizeSchwabEquityAwardsPair(
  transactionRow: RawCSVRow,
  detailRows: RawCSVRow[],
  fileId: string,
  rowIndex: number
): GenericTransaction | null {
  // Transaction row has: Date, Action, Symbol, Description, Quantity
  const date = parseUSDate(transactionRow['Date'])
  const action = transactionRow['Action']?.trim()
  const symbol = transactionRow['Symbol']?.trim()
  const description = transactionRow['Description']?.trim()
  const quantityStr = transactionRow['Quantity']?.trim()

  // Detail rows have: AwardDate, AwardId, FairMarketValuePrice, SharesSoldWithheldForTaxes, NetSharesDeposited, Taxes.
  // A lapse covering several awards has one detail row per award: shares are summed,
  // and the fair market value (the same for every award on the vest date) taken from the first.
  const fmvPrice = detailRows.map(row => parseCurrency(row['FairMarketValuePrice'])).find(price => price !== null) ?? null
  const sumDetail = (field: string) => detailRows.reduce((sum, row) => sum + (parseNumber(row[field]) || 0), 0)
  const sharesSoldForTaxes = sumDetail('SharesSoldWithheldForTaxes')
  const netShares = sumDetail('NetSharesDeposited')
  const taxes = detailRows.reduce((sum, row) => sum + (parseCurrency(row['Taxes']) || 0), 0)

  if (!date || !symbol || !action) {
    return null
  }

  // Total quantity vested (before tax withholding)
  const totalQuantity = parseNumber(quantityStr) || 0

  // Net shares received after tax withholding
  const quantity = netShares

  // Price is the Fair Market Value at vest
  const price = fmvPrice

  // Total value is based on net shares received (quantity), not total vested
  const total = quantity && price ? quantity * price : null

  // Type mapping
  let type: typeof TransactionType[keyof typeof TransactionType]
  const actionLower = action.toLowerCase()
  if (actionLower.includes('lapse') && detailRows.length === 0) {
    // The award details (fair market value, net shares) are missing, e.g. a
    // truncated export. Flag the row rather than record a 0-share purchase.
    return {
      id: `${fileId}-${rowIndex}`,
      source: 'Charles Schwab Equity Awards',
      symbol,
      name: description,
      date,
      type: TransactionType.UNKNOWN,
      quantity: totalQuantity || null,
      price: null,
      currency: 'USD',
      total: null,
      fee: null,
      notes: 'RSU vest is missing its award detail row (fair market value and net shares), so it could not be read',
    }
  } else if (actionLower.includes('lapse')) {
    type = TransactionType.BUY // RSU vest = acquiring shares
  } else if (actionLower.includes('wire') || actionLower.includes('transfer')) {
    type = TransactionType.TRANSFER // cash or shares moved out; not a disposal
  } else {
    // Return UNKNOWN for unrecognized actions
    console.warn(`Unknown Schwab Equity Awards action: "${action}", marking as UNKNOWN`)
    type = TransactionType.UNKNOWN
  }

  // Notes about tax withholding
  const notes = sharesSoldForTaxes > 0
    ? `RSU vest: ${totalQuantity} shares vested, ${sharesSoldForTaxes} sold for taxes ($${taxes.toFixed(2)}), ${netShares} net shares deposited`
    : null

  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Charles Schwab Equity Awards',
    symbol,
    name: description,
    date,
    type,
    quantity,
    price,
    currency: 'USD',
    total,
    fee: null,
    notes,
  }
}

