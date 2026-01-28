import { BrokerType } from '../../types/broker'
import { BrokerDefinition } from '../../types/brokerDefinition'
import { normalizeSchwabTransactions } from '../../lib/parsers/schwab'

export const schwabDefinition: BrokerDefinition = {
  type: BrokerType.SCHWAB,
  displayName: 'Charles Schwab',
  shortId: 'schwab',
  detection: {
    requiredHeaders: ['Date', 'Action', 'Symbol', 'Description', 'Quantity', 'Price', 'Fees & Comm', 'Amount'],
    priority: 20,
  },
  parser: (rows, fileId, _source) => normalizeSchwabTransactions(rows, fileId),
  instructions: {
    steps: [
      'Log into schwab.com → Accounts → Transaction History',
      'Select "Brokerage Accounts" from account dropdown',
      'Select your account and date range (max 4 years)',
      'Click Export → CSV',
    ],
    notes: ['Schwab limits downloads to 4 years. For longer history, download in 4-year chunks and upload multiple files.'],
    info: 'If you have equity awards (RSUs, stock options), also download "Equity Awards" history separately and upload both files together.',
  },
  exampleFile: '/examples/schwab-transactions-example.csv',
  enabled: true,
}
