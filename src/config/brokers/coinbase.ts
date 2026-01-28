import { BrokerType } from '../../types/broker'
import { BrokerDefinition } from '../../types/brokerDefinition'
import { normalizeCoinbaseTransactions } from '../../lib/parsers/coinbase'

export const coinbaseDefinition: BrokerDefinition = {
  type: BrokerType.COINBASE,
  displayName: 'Coinbase',
  shortId: 'coinbase',
  detection: {
    requiredHeaders: ['Timestamp', 'Transaction Type', 'Asset', 'Quantity Transacted', 'Price at Transaction', 'Fees and/or Spread'],
    priority: 60,
  },
  parser: normalizeCoinbaseTransactions,
  instructions: {
    steps: [
      'Log into coinbase.com',
      'Go to Profile → Manage Account → Statements',
      'Select date range "Custom" and set Start date as early as possible',
      'Click "Generate"',
    ],
    notes: ['Crypto transactions are treated like stock transactions for CGT purposes. The same HMRC matching rules apply.'],
  },
  exampleFile: '/examples/coinbase-example.csv',
  enabled: true,
}
