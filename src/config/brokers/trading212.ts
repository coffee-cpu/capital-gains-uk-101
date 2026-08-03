import { BrokerType, RawCSVRow } from '../../types/broker'
import { BrokerDefinition } from '../../types/brokerDefinition'
import { normalizeTrading212Transactions } from '../../lib/parsers/trading212'

function detectTrading212Headers(headers: string[], rows: RawCSVRow[]) {
  void rows
  const normalizedHeaders = headers.map(header => header.trim())
  const hasAction = normalizedHeaders.includes('Action')
  const hasTime = normalizedHeaders.includes('Time') || normalizedHeaders.includes('Time (UTC)')
  const hasIsin = normalizedHeaders.includes('ISIN')
  const hasTicker = normalizedHeaders.includes('Ticker')
  const hasShares = normalizedHeaders.includes('No. of shares') || normalizedHeaders.includes('Quantity')
  const hasTotal = normalizedHeaders.includes('Total')

  const matchedHeaders = [
    hasAction ? 'Action' : null,
    hasTime ? 'Time' : null,
    hasIsin ? 'ISIN' : null,
    hasTicker ? 'Ticker' : null,
    hasShares ? 'No. of shares' : null,
    hasTotal ? 'Total' : null,
  ].filter((header): header is string => header !== null)

  return {
    broker: BrokerType.TRADING212,
    confidence: matchedHeaders.length / 6,
    headerMatches: matchedHeaders,
  }
}

export const trading212Definition: BrokerDefinition = {
  type: BrokerType.TRADING212,
  displayName: 'Trading 212',
  shortId: 'trading212',
  detection: {
    requiredHeaders: ['Action', 'Time', 'ISIN', 'Ticker', 'No. of shares'],
    priority: 50,
    customDetector: detectTrading212Headers,
  },
  parser: normalizeTrading212Transactions,
  instructions: {
    steps: [
      'Log into Trading 212 app or website',
      'Go to Menu → History',
      'Tap the export button',
      'Select timeframe (max 1 year) and data types',
      'Download the CSV file when ready',
    ],
    notes: ['Trading 212 limits downloads to 1 year. For longer history, download year by year and upload multiple files.'],
  },
  exampleFile: '/examples/trading212-example.csv',
  enabled: true,
}
