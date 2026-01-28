import { BrokerType } from '../../types/broker'
import { BrokerDefinition } from '../../types/brokerDefinition'
import { normalizeCoinbaseProTransactions } from '../../lib/parsers/coinbasePro'

export const coinbaseProDefinition: BrokerDefinition = {
  type: BrokerType.COINBASE_PRO,
  displayName: 'Coinbase Pro',
  shortId: 'coinbasepro',
  detection: {
    requiredHeaders: ['portfolio', 'trade id', 'product', 'side', 'created at', 'size', 'size unit', 'price', 'fee', 'total', 'price/fee/total unit'],
    priority: 55, // Check before regular Coinbase
  },
  parser: normalizeCoinbaseProTransactions,
  instructions: {
    steps: [
      'Log into coinbase.com',
      'Go to Profile → Manage Account → Statements',
      'Select "Other" portfolio',
      'Select "Fills" in custom report type',
      'Download the CSV file (1 for each year)',
    ],
    notes: ['Coinbase Pro is now part of Coinbase Advanced Trade. This is for historical coinbase pro transactions.'],
    warning: 'For crypto-to-crypto trades (e.g., LINK-ETH), add a gbp_value column with the GBP spot price of the quote currency (e.g., ETH price in GBP) for accurate CGT calculation.',
  },
  exampleFile: '/examples/coinbasepro-example.csv',
  enabled: true,
}
