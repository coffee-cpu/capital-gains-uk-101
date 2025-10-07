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
  if (schwabResult.confidence > trading212Result.confidence) {
    return schwabResult
  } else if (trading212Result.confidence > 0) {
    return trading212Result
  }

  return {
    broker: BrokerType.UNKNOWN,
    confidence: 0,
    headerMatches: [],
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
