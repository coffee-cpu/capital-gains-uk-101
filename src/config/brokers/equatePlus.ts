import { BrokerType } from '../../types/broker'
import { BrokerDefinition } from '../../types/brokerDefinition'
import { normalizeEquatePlusTransactions } from '../../lib/parsers/equatePlus'

export const equatePlusDefinition: BrokerDefinition = {
  type: BrokerType.EQUATE_PLUS,
  displayName: 'EquatePlus',
  shortId: 'equateplus',
  detection: {
    requiredHeaders: ['Order reference', 'Date', 'Order type', 'Quantity', 'Execution price', 'Instrument', 'Product type'],
    priority: 50,
  },
  parser: (rows, fileId, _source) => normalizeEquatePlusTransactions(rows, fileId),
  instructions: {
    steps: [
      'Log into your EquatePlus account',
      'Navigate to Activity or Transaction History',
      'Select the date range for your transactions',
      'Export (it will be XLSX, you need to convert it to CSV)',
    ],
    notes: ['EquatePlus is commonly used for employee stock plans (RSUs, RSPs, ESPP). The CSV includes vesting events, sales, dividends, and withholding transactions.'],
  },
  exampleFile: '/examples/equateplus-example.csv',
  enabled: true,
}
