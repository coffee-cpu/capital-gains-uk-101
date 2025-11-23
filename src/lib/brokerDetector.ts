import { BrokerType, BrokerDetectionResult, RawCSVRow } from '../types/broker'

/**
 * Detect broker from CSV headers and data patterns
 */
export function detectBroker(rows: RawCSVRow[]): BrokerDetectionResult {
  if (rows.length === 0) {
    return {
      broker: BrokerType.UNKNOWN,
      confidence: 0,
      headerMatches: [],
    }
  }

  const headers = Object.keys(rows[0])

  // Check for Interactive Brokers (check first - very distinctive multi-section format)
  const ibResult = detectInteractiveBrokers(headers, rows)
  if (ibResult.confidence > 0.8) {
    return ibResult
  }

  // Check for Generic CSV (check second - most explicit format)
  const genericResult = detectGeneric(headers, rows)
  if (genericResult.confidence > 0.8) {
    return genericResult
  }

  // Check for Freetrade (check before others - distinctive format)
  const freetradeResult = detectFreetrade(headers, rows)
  if (freetradeResult.confidence > 0.8) {
    return freetradeResult
  }

  // Check for Schwab Equity Awards (check before regular Schwab)
  const schwabEquityResult = detectSchwabEquityAwards(headers, rows)
  if (schwabEquityResult.confidence > 0.8) {
    return schwabEquityResult
  }

  // Check for Schwab
  const schwabResult = detectSchwab(headers, rows)
  if (schwabResult.confidence > 0.8) {
    return schwabResult
  }

  // Check for Trading 212
  const trading212Result = detectTrading212(headers, rows)
  if (trading212Result.confidence > 0.8) {
    return trading212Result
  }

  // Check for EquatePlus
  const equatePlusResult = detectEquatePlus(headers, rows)
  if (equatePlusResult.confidence > 0.8) {
    return equatePlusResult
  }

  // Return best match or unknown
  const results = [ibResult, genericResult, freetradeResult, schwabEquityResult, schwabResult, trading212Result, equatePlusResult]
  const bestMatch = results.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  )

  if (bestMatch.confidence > 0) {
    return bestMatch
  }

  return {
    broker: BrokerType.UNKNOWN,
    confidence: 0,
    headerMatches: [],
  }
}

/**
 * Detect Generic CSV format
 * Required headers: "date", "type", "symbol", "currency"
 */
function detectGeneric(headers: string[], _rows: RawCSVRow[]): BrokerDetectionResult {
  const requiredHeaders = ['date', 'type', 'symbol', 'currency']

  const matches = requiredHeaders.filter(h => headers.includes(h))
  const confidence = matches.length / requiredHeaders.length

  return {
    broker: BrokerType.GENERIC,
    confidence,
    headerMatches: matches,
  }
}

/**
 * Detect Schwab Equity Awards format
 * Expected headers: "Date", "Action", "Symbol", "FairMarketValuePrice", "NetSharesDeposited", etc.
 */
function detectSchwabEquityAwards(headers: string[], _rows: RawCSVRow[]): BrokerDetectionResult {
  const equityHeaders = ['Date', 'Action', 'Symbol', 'FairMarketValuePrice', 'NetSharesDeposited', 'AwardDate']

  const matches = equityHeaders.filter(h => headers.includes(h))
  const confidence = matches.length / equityHeaders.length

  return {
    broker: BrokerType.SCHWAB_EQUITY_AWARDS,
    confidence,
    headerMatches: matches,
  }
}

/**
 * Detect Charles Schwab format
 * Expected headers: "Date", "Action", "Symbol", "Description", "Quantity", "Price", "Fees & Comm", "Amount"
 */
function detectSchwab(headers: string[], _rows: RawCSVRow[]): BrokerDetectionResult {
  const schwabHeaders = ['Date', 'Action', 'Symbol', 'Description', 'Quantity', 'Price', 'Fees & Comm', 'Amount']

  const matches = schwabHeaders.filter(h => headers.includes(h))
  const confidence = matches.length / schwabHeaders.length

  return {
    broker: BrokerType.SCHWAB,
    confidence,
    headerMatches: matches,
  }
}

/**
 * Detect Trading 212 format
 * Expected headers might include: "Action", "Time", "ISIN", "Ticker", "Name", "No. of shares", "Price / share", "Result", etc.
 */
function detectTrading212(headers: string[], _rows: RawCSVRow[]): BrokerDetectionResult {
  const trading212Headers = ['Action', 'Time', 'ISIN', 'Ticker', 'No. of shares']

  const matches = trading212Headers.filter(h => headers.includes(h))
  const confidence = matches.length / trading212Headers.length

  return {
    broker: BrokerType.TRADING212,
    confidence,
    headerMatches: matches,
  }
}

/**
 * Detect Freetrade format
 * Expected headers: "Title", "Type", "Timestamp", "Buy / Sell", "Ticker", "ISIN", "Order Type"
 */
function detectFreetrade(headers: string[], _rows: RawCSVRow[]): BrokerDetectionResult {
  const freetradeHeaders = ['Title', 'Type', 'Timestamp', 'Buy / Sell', 'Ticker', 'ISIN', 'Order Type']

  const matches = freetradeHeaders.filter(h => headers.includes(h))
  const confidence = matches.length / freetradeHeaders.length

  return {
    broker: BrokerType.FREETRADE,
    confidence,
    headerMatches: matches,
  }
}

/**
 * Detect EquatePlus format
 * Expected headers: "Order reference", "Date", "Order type", "Quantity", "Execution price", "Instrument", "Product type"
 */
function detectEquatePlus(headers: string[], _rows: RawCSVRow[]): BrokerDetectionResult {
  const equatePlusHeaders = ['Order reference', 'Date', 'Order type', 'Quantity', 'Execution price', 'Instrument', 'Product type']

  const matches = equatePlusHeaders.filter(h => headers.includes(h))
  const confidence = matches.length / equatePlusHeaders.length

  return {
    broker: BrokerType.EQUATE_PLUS,
    confidence,
    headerMatches: matches,
  }
}

/**
 * Detect Interactive Brokers format
 * Multi-section CSV with distinctive structure:
 * - First column is section name (e.g., "Trades", "Cash Transactions")
 * - Second column is row type ("Header" or "Data")
 * - Characteristic headers: "DataDiscriminator", "Asset Category", "Symbol", "Date/Time"
 */
function detectInteractiveBrokers(headers: string[], rows: RawCSVRow[]): BrokerDetectionResult {
  // IB CSV has a very distinctive multi-section format
  // First column contains section names like "Trades", "Cash Transactions", "Corporate Actions"
  // Second column is always "Header" or "Data"

  const firstColumnValues = rows.slice(0, 10).map(row => Object.values(row)[0]).filter(Boolean)
  const hasTradesSection = firstColumnValues.some(val => val === 'Trades')
  const hasCashTransactions = firstColumnValues.some(val => val === 'Cash Transactions')
  const hasSectionFormat = firstColumnValues.some(val =>
    val === 'Trades' || val === 'Cash Transactions' || val === 'Corporate Actions'
  )

  // Check for second column being "Header" or "Data"
  const secondColumnValues = rows.slice(0, 10).map(row => Object.values(row)[1]).filter(Boolean)
  const hasRowTypeColumn = secondColumnValues.some(val => val === 'Header' || val === 'Data')

  // Check for characteristic IB headers
  const ibHeaders = ['DataDiscriminator', 'Asset Category', 'Date/Time', 'T. Price', 'Comm/Fee']
  const headerMatches = ibHeaders.filter(h => headers.includes(h))

  let confidence = 0

  // Strong indicators
  if (hasSectionFormat && hasRowTypeColumn) {
    confidence = 0.9
  } else if (hasTradesSection || hasCashTransactions) {
    confidence = 0.7
  } else if (headerMatches.length >= 3) {
    confidence = 0.6
  } else if (headerMatches.length >= 2) {
    confidence = 0.4
  }

  return {
    broker: BrokerType.INTERACTIVE_BROKERS,
    confidence,
    headerMatches: headerMatches.length > 0 ? headerMatches : (hasSectionFormat ? ['Trades/Cash Transactions section format'] : []),
  }
}
