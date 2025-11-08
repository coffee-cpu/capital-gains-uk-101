import { GenericTransaction, TransactionType } from '../../types/transaction'
import { RawCSVRow } from '../../types/broker'

/**
 * Normalize Freetrade CSV rows to GenericTransaction format
 * @param rows Raw CSV rows
 * @param fileId Unique identifier for this file (e.g. 'freetrade-abc123')
 */
export function normalizeFreetradeTransactions(rows: RawCSVRow[], fileId: string): GenericTransaction[] {
  const transactions: GenericTransaction[] = []
  let rowIndex = 1

  for (const row of rows) {
    const normalized = normalizeFreetradeRow(row, fileId, rowIndex)
    if (normalized) {
      transactions.push(normalized)
      rowIndex++
    }
  }

  return transactions
}

/**
 * Normalize a single Freetrade row
 */
function normalizeFreetradeRow(row: RawCSVRow, fileId: string, rowIndex: number): GenericTransaction | null {
  const type = row['Type']?.trim()
  const title = row['Title']?.trim()
  const timestamp = row['Timestamp']?.trim()
  const ticker = row['Ticker']?.trim()
  const isin = row['ISIN']?.trim()

  // Parse date from timestamp (ISO format: 2025-11-01T00:00:00.000Z)
  const date = parseFreetradeDate(timestamp)
  if (!date) {
    return null // Skip rows with invalid dates
  }

  // Handle different transaction types
  if (type === 'ORDER' || type === 'FREESHARE_ORDER') {
    return parseOrderTransaction(row, fileId, rowIndex, date, title, ticker, isin, type === 'FREESHARE_ORDER')
  } else if (type === 'DIVIDEND') {
    return parseDividendTransaction(row, fileId, rowIndex, date, title, ticker, isin)
  } else if (type === 'INTEREST_FROM_CASH') {
    return parseInterestTransaction(row, fileId, rowIndex, date)
  } else if (type === 'TOP_UP' || type === 'WITHDRAWAL') {
    return parseTransferTransaction(row, fileId, rowIndex, date, type)
  } else if (type === 'STOCK_SPLIT') {
    return parseStockSplitTransaction(row, fileId, rowIndex, date, title, ticker, isin)
  }

  // Skip unknown types (e.g., MONTHLY_STATEMENT, TAX_CERTIFICATE)
  return null
}

/**
 * Parse ORDER transaction (BUY or SELL) or FREESHARE_ORDER
 */
function parseOrderTransaction(
  row: RawCSVRow,
  fileId: string,
  rowIndex: number,
  date: string,
  title: string,
  ticker: string,
  isin: string,
  isFreeShare = false
): GenericTransaction | null {
  const buySell = row['Buy / Sell']?.trim()
  const quantity = parseFloat(row['Quantity']) || null
  const accountCurrency = row['Account Currency']?.trim() || 'GBP'

  // For free shares, price and amount are £0 (no acquisition cost per HMRC)
  let pricePerShare: number | null
  let totalAmount: number | null
  let stampDuty: number | null
  let fxFeeAmount: number | null

  if (isFreeShare) {
    pricePerShare = 0
    totalAmount = 0
    stampDuty = 0
    fxFeeAmount = 0
  } else {
    pricePerShare = parseFloat(row['Price per Share in Account Currency']) || null
    totalAmount = parseFloat(row['Total Amount']) || null
    stampDuty = parseFloat(row['Stamp Duty']) || null
    fxFeeAmount = parseFloat(row['FX Fee Amount']) || null
  }

  // Determine if this is a buy or sell (free shares are always BUY)
  const isBuy = isFreeShare || buySell === 'BUY'
  const type = isBuy ? TransactionType.BUY : TransactionType.SELL

  // Combine stamp duty and FX fees (both are allowable costs per HMRC CG15250)
  let totalFee: number | null = null
  const feeNotes: string[] = []

  if (stampDuty !== null && stampDuty > 0) {
    totalFee = stampDuty
    feeNotes.push(`Stamp Duty: ${stampDuty}`)
  }

  if (fxFeeAmount !== null && fxFeeAmount > 0) {
    totalFee = totalFee !== null ? totalFee + fxFeeAmount : fxFeeAmount
    feeNotes.push(`FX Fee: ${fxFeeAmount}`)
  }

  // Build notes
  const notes: string[] = []
  if (isin) notes.push(`ISIN: ${isin}`)
  if (isFreeShare) notes.push('Free share (£0 acquisition cost)')
  if (feeNotes.length > 0) notes.push(feeNotes.join(', '))

  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Freetrade',
    symbol: ticker || '',
    name: title || null,
    date,
    type,
    quantity,
    price: pricePerShare,
    currency: accountCurrency,
    total: totalAmount !== null ? Math.abs(totalAmount) : null,
    fee: totalFee,
    ratio: null,
    notes: notes.length > 0 ? notes.join(', ') : null,
    incomplete: false,
    ignored: false,
  }
}

/**
 * Parse DIVIDEND transaction
 */
function parseDividendTransaction(
  row: RawCSVRow,
  fileId: string,
  rowIndex: number,
  date: string,
  title: string,
  ticker: string,
  isin: string
): GenericTransaction | null {
  const netAmount = parseFloat(row['Dividend Net Distribution Amount']) || null
  const grossAmount = parseFloat(row['Dividend Gross Distribution Amount']) || null
  const withheldTax = parseFloat(row['Dividend Withheld Tax Amount']) || null
  const accountCurrency = row['Account Currency']?.trim() || 'GBP'
  const quantity = parseFloat(row['Dividend Eligible Quantity']) || null

  const notes = []
  if (isin) notes.push(`ISIN: ${isin}`)
  if (grossAmount && netAmount && withheldTax) {
    notes.push(`Gross: ${grossAmount} ${accountCurrency}, Tax withheld: ${withheldTax} ${accountCurrency}`)
  }

  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Freetrade',
    symbol: ticker || '',
    name: title || null,
    date,
    type: TransactionType.DIVIDEND,
    quantity, // Number of shares eligible for dividend
    price: null,
    currency: accountCurrency,
    total: netAmount,
    fee: withheldTax, // Withheld tax treated as fee
    ratio: null,
    notes: notes.length > 0 ? notes.join(', ') : null,
    incomplete: false,
    ignored: false,
  }
}

/**
 * Parse INTEREST_FROM_CASH transaction
 */
function parseInterestTransaction(
  row: RawCSVRow,
  fileId: string,
  rowIndex: number,
  date: string
): GenericTransaction | null {
  const totalAmount = parseFloat(row['Total Amount']) || null
  const accountCurrency = row['Account Currency']?.trim() || 'GBP'

  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Freetrade',
    symbol: 'CASH',
    name: 'Interest from Cash',
    date,
    type: TransactionType.INTEREST,
    quantity: null,
    price: null,
    currency: accountCurrency,
    total: totalAmount,
    fee: null,
    ratio: null,
    notes: null,
    incomplete: false,
    ignored: false,
  }
}

/**
 * Parse TOP_UP or WITHDRAWAL transaction
 */
function parseTransferTransaction(
  row: RawCSVRow,
  fileId: string,
  rowIndex: number,
  date: string,
  type: string
): GenericTransaction | null {
  const totalAmount = parseFloat(row['Total Amount']) || null
  const accountCurrency = row['Account Currency']?.trim() || 'GBP'

  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Freetrade',
    symbol: 'CASH',
    name: type === 'TOP_UP' ? 'Top up' : 'Withdrawal',
    date,
    type: TransactionType.TRANSFER,
    quantity: null,
    price: null,
    currency: accountCurrency,
    total: totalAmount !== null ? Math.abs(totalAmount) : null,
    fee: null,
    ratio: null,
    notes: type === 'TOP_UP' ? 'Deposit' : 'Withdrawal',
    incomplete: false,
    ignored: false,
  }
}

/**
 * Parse STOCK_SPLIT transaction (if present in Freetrade data)
 */
function parseStockSplitTransaction(
  row: RawCSVRow,
  fileId: string,
  rowIndex: number,
  date: string,
  title: string,
  ticker: string,
  isin: string
): GenericTransaction | null {
  const fromShares = parseFloat(row['Stock Split Rate of Share Outturn From']) || null
  const toShares = parseFloat(row['Stock Split Rate of Share Outturn To']) || null

  // Create ratio string in "new:old" format
  const ratio = fromShares && toShares ? `${toShares}:${fromShares}` : null

  const notes = []
  if (isin) notes.push(`ISIN: ${isin}`)
  if (ratio) notes.push(`Stock split: ${ratio}`)

  return {
    id: `${fileId}-${rowIndex}`,
    source: 'Freetrade',
    symbol: ticker || '',
    name: title || null,
    date,
    type: TransactionType.STOCK_SPLIT,
    quantity: null,
    price: null,
    currency: 'GBP',
    total: null,
    fee: null,
    ratio,
    notes: notes.length > 0 ? notes.join(', ') : null,
    incomplete: !ratio,
    ignored: false,
  }
}

/**
 * Parse Freetrade date format: ISO 8601 (2025-11-01T00:00:00.000Z)
 * Returns ISO date string (YYYY-MM-DD) or null
 */
function parseFreetradeDate(dateStr: string): string | null {
  if (!dateStr) return null

  // Freetrade uses ISO 8601 format - just extract the date part
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null

  const [, year, month, day] = match
  return `${year}-${month}-${day}`
}
