import { BrokerType, RawCSVRow, BrokerDetectionResult } from '../../types/broker'
import { BrokerDefinition } from '../../types/brokerDefinition'
import { normalizeTrading212Transactions } from '../../lib/parsers/trading212'

function detectTrading212Headers(headers: string[], _rows: RawCSVRow[]): BrokerDetectionResult {
  const normalizedHeaders = headers.map(header => header.trim())
  const matchFirst = (...candidates: string[]) =>
    candidates.find(candidate => normalizedHeaders.includes(candidate))

  const action = matchFirst('Action')
  const time = matchFirst('Time', 'Time (UTC)')
  const isin = matchFirst('ISIN')
  const ticker = matchFirst('Ticker')
  const shares = matchFirst('No. of shares')
  const pricePerShare = matchFirst('Price / share')
  const priceCurrency = matchFirst('Currency (Price / share)')

  // Anchor on Trading 212-specific share/price columns before reporting any
  // confidence: a generic CSV carrying Action/Time/Ticker/Total would
  // otherwise score high enough to short-circuit lower-priority brokers.
  const isTrading212Shape = Boolean(
    action && time && ticker && (shares || pricePerShare || priceCurrency)
  )
  if (!isTrading212Shape) {
    return { broker: BrokerType.TRADING212, confidence: 0, headerMatches: [] }
  }

  // Score over the five core columns present in both the legacy ("Time")
  // and newer ("Time (UTC)") export formats.
  const coreMatches = [action, time, isin, ticker, shares].filter(
    (header): header is string => header !== undefined
  )

  return {
    broker: BrokerType.TRADING212,
    confidence: coreMatches.length / 5,
    headerMatches: coreMatches,
  }
}

export const trading212Definition: BrokerDefinition = {
  type: BrokerType.TRADING212,
  displayName: 'Trading 212',
  shortId: 'trading212',
  detection: {
    requiredHeaders: [], // Uses custom detector instead
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
