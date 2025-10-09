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

  // Check for Generic CSV (check first - most explicit format)
  const genericResult = detectGeneric(headers, rows)
  if (genericResult.confidence > 0.8) {
    return genericResult
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

  // Return best match or unknown
  const results = [genericResult, schwabEquityResult, schwabResult, trading212Result]
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
function detectGeneric(headers: string[], rows: RawCSVRow[]): BrokerDetectionResult {
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
function detectSchwabEquityAwards(headers: string[], rows: RawCSVRow[]): BrokerDetectionResult {
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
function detectSchwab(headers: string[], rows: RawCSVRow[]): BrokerDetectionResult {
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
function detectTrading212(headers: string[], rows: RawCSVRow[]): BrokerDetectionResult {
  const trading212Headers = ['Action', 'Time', 'ISIN', 'Ticker', 'No. of shares']

  const matches = trading212Headers.filter(h => headers.includes(h))
  const confidence = matches.length / trading212Headers.length

  return {
    broker: BrokerType.TRADING212,
    confidence,
    headerMatches: matches,
  }
}
