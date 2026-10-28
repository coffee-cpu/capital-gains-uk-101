import { BrokerType } from '../../types/broker'
import { BrokerDefinition } from '../../types/brokerDefinition'
import { normalizeRevolutTransactions } from '../../lib/parsers/revolut'

export const revolutDefinition: BrokerDefinition = {
  type: BrokerType.REVOLUT,
  displayName: 'Revolut',
  shortId: 'revolut',
  detection: {
    requiredHeaders: ['Date', 'Ticker', 'Type', 'Quantity', 'Price per share', 'Total Amount', 'Currency', 'FX Rate'],
    priority: 50,
  },
  parser: normalizeRevolutTransactions,
  instructions: {
    steps: [
      'Open the Revolut app and go to the Invest tab',
      'Tap More → Documents',
      'Choose Brokerage account (shown as Stocks in some app versions)',
      'Select Account statement (not Profit and Loss)',
      'Choose CSV format and period "All time", then tap Get statement',
      'Save or share the CSV file to your device',
    ],
    notes: [
      'The statement includes trades, dividends, cash top-ups and withdrawals for the whole period.',
      'If your app only offers Excel, choose Excel and save the file as CSV (comma-separated) before uploading.',
    ],
  },
  exampleFile: '/examples/revolut-example.csv',
  helpLinks: [
    {
      label: 'Official instructions',
      url: 'https://help.revolut.com/help/profile-and-plan/managing-my-account/trading-statements-and-reports/',
    },
  ],
  enabled: true,
}
