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
    steps: [],
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
