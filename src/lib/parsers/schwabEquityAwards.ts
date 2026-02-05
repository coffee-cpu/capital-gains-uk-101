import { GenericTransaction, TransactionType } from '../../types/transaction'
import { RawCSVRow } from '../../types/broker'
import { parseUSDate, parseCurrency } from './parsingUtils'

/**
 * Normalize Schwab Equity Awards CSV rows to GenericTransaction format
 * This format has paired rows - the transaction row followed by a detail row
 * @param rows Raw CSV rows
 * @param fileId Unique identifier for this file
 */
export function normalizeSchwabEquityAwardsTransactions(rows: RawCSVRow[], fileId: string): GenericTransaction[] {
  const transactions: GenericTransaction[] = []
  let rowIndex = 1

  // Process pairs of rows
  for (let i = 0; i < rows.length; i += 2) {
    const transactionRow = rows[i]
    const detailRow = rows[i + 1]

    if (!transactionRow || !detailRow) break

    const normalized = normalizeSchwabEquityAwardsPair(transactionRow, detailRow, fileId, rowIndex)
    if (normalized) {
      transactions.push(normalized)
      rowIndex++
    }
  }

  return transactions
}

/**
 * Normalize a pair of Schwab Equity Awards rows (transaction + details)
 */
function normalizeSchwabEquityAwardsPair(
  transactionRow: RawCSVRow,
  detailRow: RawCSVRow,
  fileId: string,
  rowIndex: number
): GenericTransaction | null {
  // Transaction row has: Date, Action, Symbol, Description, Quantity
  const date = parseUSDate(transactionRow['Date'])
  const action = transactionRow['Action']?.trim()
  const symbol = transactionRow['Symbol']?.trim()
  const description = transactionRow['Description']?.trim()
  const quantityStr = transactionRow['Quantity']?.trim()

  // Detail row has: AwardDate, AwardId, FairMarketValuePrice, SharesSoldWithheldForTaxes, NetSharesDeposited, Taxes
  const fmvPrice = parseCurrency(detailRow['FairMarketValuePrice'])
  const sharesSoldForTaxes = parseFloat(detailRow['SharesSoldWithheldForTaxes']) || 0
  const netShares = parseFloat(detailRow['NetSharesDeposited']) || 0
  const taxes = parseCurrency(detailRow['Taxes']) || 0

  if (!date || !symbol || !action) {
    return null
  }

  // Total quantity vested (before tax withholding)
  const totalQuantity = parseFloat(quantityStr) || 0

  // Net shares received after tax withholding
  const quantity = netShares

  // Price is the Fair Market Value at vest
  const price = fmvPrice

  // Total value is based on net shares received (quantity), not total vested
  const total = quantity && price ? quantity * price : null

  // Type mapping
  let type: typeof TransactionType[keyof typeof TransactionType]
  if (action.toLowerCase().includes('lapse')) {
    type = TransactionType.BUY // RSU vest = acquiring shares
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

