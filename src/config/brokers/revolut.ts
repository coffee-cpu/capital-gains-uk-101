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
      'Use the CSV option: files converted from Revolut\'s Excel export may have dates in a different format and won\'t import correctly. If CSV isn\'t offered, update the app.',
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
