import { BrokerType } from '../../types/broker'
import { BrokerDefinition } from '../../types/brokerDefinition'
import { normalizeFreetradeTransactions } from '../../lib/parsers/freetrade'

export const freetradeDefinition: BrokerDefinition = {
  type: BrokerType.FREETRADE,
  displayName: 'Freetrade',
  shortId: 'freetrade',
  detection: {
    requiredHeaders: ['Title', 'Type', 'Timestamp', 'Buy / Sell', 'Ticker', 'ISIN', 'Order Type'],
    priority: 50,
  },
  parser: (rows, fileId, _source) => normalizeFreetradeTransactions(rows, fileId),
  instructions: {
    steps: [
      'Open Freetrade mobile app (iOS/Android)',
      'Navigate to Activity tab (bottom of screen)',
      'Optional: Use calendar icon to select custom date range',
      'Tap Share icon (arrow pointing up) in top-right corner',
      'Select "All Activity" and export file to device',
    ],
    notes: ['Freetrade exports all activity at once. The CSV includes trades, dividends, interest, deposits, and withdrawals.'],
  },
  exampleFile: '/examples/freetrade-example.csv',
  helpLinks: [
    {
      label: 'Official instructions',
      url: 'https://help.freetrade.io/en/articles/6627908-how-do-i-download-a-csv-export-of-my-activity-feed',
    },
  ],
  enabled: true,
}
