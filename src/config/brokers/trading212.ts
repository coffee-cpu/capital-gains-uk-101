import { BrokerType } from '../../types/broker'
import { BrokerDefinition } from '../../types/brokerDefinition'
import { normalizeTrading212Transactions } from '../../lib/parsers/trading212'

export const trading212Definition: BrokerDefinition = {
  type: BrokerType.TRADING212,
  displayName: 'Trading 212',
  shortId: 'trading212',
  detection: {
    requiredHeaders: ['Action', 'Time', 'ISIN', 'Ticker', 'No. of shares'],
    priority: 50,
  },
  parser: (rows, fileId, _source) => normalizeTrading212Transactions(rows, fileId),
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
