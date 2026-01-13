import { BrokerType, BrokerDetectionResult, RawCSVRow } from '../types/broker'

/**
 * Configuration for header-based broker detection
 * Each config defines required headers and the broker type
 */
interface BrokerConfig {
  broker: BrokerType
  headers: string[]
}

/**
 * Standard broker configurations for header-based detection
 * Order matters: more specific brokers should come first
 */
const BROKER_CONFIGS: BrokerConfig[] = [
  // Schwab Equity Awards must come before regular Schwab (more specific headers)
  {
    broker: BrokerType.SCHWAB_EQUITY_AWARDS,
    headers: ['Date', 'Action', 'Symbol', 'FairMarketValuePrice', 'NetSharesDeposited', 'AwardDate'],
  },
  {
    broker: BrokerType.SCHWAB,
    headers: ['Date', 'Action', 'Symbol', 'Description', 'Quantity', 'Price', 'Fees & Comm', 'Amount'],
  },
  {
    broker: BrokerType.GENERIC,
    headers: ['date', 'type', 'symbol', 'currency'],
  },
  {
    broker: BrokerType.FREETRADE,
    headers: ['Title', 'Type', 'Timestamp', 'Buy / Sell', 'Ticker', 'ISIN', 'Order Type'],
  },
  {
    broker: BrokerType.TRADING212,
    headers: ['Action', 'Time', 'ISIN', 'Ticker', 'No. of shares'],
  },
  {
    broker: BrokerType.EQUATE_PLUS,
    headers: ['Order reference', 'Date', 'Order type', 'Quantity', 'Execution price', 'Instrument', 'Product type'],
  },
  {
    broker: BrokerType.REVOLUT,
    headers: ['Date', 'Ticker', 'Type', 'Quantity', 'Price per share', 'Total Amount', 'Currency', 'FX Rate'],
  },
  {
    broker: BrokerType.COINBASE,
    headers: ['Timestamp', 'Transaction Type', 'Asset', 'Quantity Transacted', 'Price at Transaction', 'Fees and/or Spread'],
  },
]

/**
 * Detect broker using header matching
 * Returns confidence based on percentage of headers matched
 */
function detectByHeaders(headers: string[], config: BrokerConfig): BrokerDetectionResult {
  const matches = config.headers.filter(h => headers.includes(h))
  return {
    broker: config.broker,
    confidence: matches.length / config.headers.length,
    headerMatches: matches,
  }
}

/**
 * Detect broker from CSV headers and data patterns
 */
export function detectBroker(rows: RawCSVRow[]): BrokerDetectionResult {
  if (rows.length === 0) {
    return { broker: BrokerType.UNKNOWN, confidence: 0, headerMatches: [] }
  }

  const headers = Object.keys(rows[0])

  // Check Interactive Brokers first (requires special data pattern detection)
  const ibResult = detectInteractiveBrokers(headers, rows)
  if (ibResult.confidence > 0.8) {
    return ibResult
  }

  // Run all standard header-based detections
  const results = BROKER_CONFIGS.map(config => detectByHeaders(headers, config))

  // Find high-confidence match (>0.8)
  const highConfidenceMatch = results.find(r => r.confidence > 0.8)
  if (highConfidenceMatch) {
    return highConfidenceMatch
  }

  // Return best match or unknown
  const allResults = [ibResult, ...results]
  const bestMatch = allResults.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  )

  return bestMatch.confidence > 0
    ? bestMatch
    : { broker: BrokerType.UNKNOWN, confidence: 0, headerMatches: [] }
}

/**
 * Detect Interactive Brokers format
 * Multi-section CSV with distinctive structure:
 * - First column is section name (e.g., "Transaction History", "Statement", "Summary")
 * - Second column is row type ("Header" or "Data")
 * - Characteristic columns: "Transaction Type", "Gross Amount", "Net Amount", "Commission"
 */
function detectInteractiveBrokers(headers: string[], rows: RawCSVRow[]): BrokerDetectionResult {
  // IB CSV has a very distinctive multi-section format
  // First column contains section names like "Transaction History", "Statement", "Summary"
  // Second column is always "Header" or "Data"

  const firstColumnValues = rows.slice(0, 20).map(row => Object.values(row)[0]).filter(Boolean)
  const hasTransactionHistorySection = firstColumnValues.some(val => val === 'Transaction History')
  const hasStatementSection = firstColumnValues.some(val => val === 'Statement')
  const hasSummarySection = firstColumnValues.some(val => val === 'Summary')
  const hasSectionFormat = hasTransactionHistorySection || hasStatementSection || hasSummarySection

  // Check for second column being "Header" or "Data"
  const secondColumnValues = rows.slice(0, 20).map(row => Object.values(row)[1]).filter(Boolean)
  const hasRowTypeColumn = secondColumnValues.some(val => val === 'Header' || val === 'Data')

  // Check for characteristic IB Transaction History headers (these appear in the first row as column names)
  const ibHeaders = ['Transaction Type', 'Gross Amount', 'Net Amount', 'Commission', 'Symbol']
  const headerMatches = ibHeaders.filter(h => headers.includes(h))

  let confidence = 0

  // Strong indicators
  if (hasTransactionHistorySection && hasRowTypeColumn) {
    confidence = 0.95
  } else if (hasSectionFormat && hasRowTypeColumn) {
    confidence = 0.85
  } else if (hasTransactionHistorySection) {
    confidence = 0.7
  } else if (headerMatches.length >= 3) {
    confidence = 0.6
  } else if (headerMatches.length >= 2) {
    confidence = 0.4
  }

  return {
    broker: BrokerType.INTERACTIVE_BROKERS,
    confidence,
    headerMatches: headerMatches.length > 0 ? headerMatches : (hasSectionFormat ? ['Transaction History section format'] : []),
  }
}
