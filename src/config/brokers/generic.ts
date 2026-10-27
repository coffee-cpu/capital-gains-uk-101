import { BrokerType } from '../../types/broker'
import { BrokerDefinition } from '../../types/brokerDefinition'
import { normalizeGenericTransactions } from '../../lib/parsers/generic'

export const genericDefinition: BrokerDefinition = {
  type: BrokerType.GENERIC,
  displayName: 'Generic CSV',
  shortId: 'generic',
  detection: {
    requiredHeaders: ['date', 'type', 'symbol', 'currency'],
    // High priority (lower number) because it has very specific lowercase headers
    priority: 15,
  },
  parser: normalizeGenericTransactions,
  instructions: {
    steps: [],
    notes: [
      'Always required: date, type, symbol, currency',
      'Required for BUY/SELL: quantity, price',
      'Required for DIVIDEND/FEE: total',
      'Required for STOCK_SPLIT: split_ratio (e.g., "10:1", "2:1", "1:10" for reverse splits)',
      'Optional: name, total, fee, notes',
      'Transaction types: BUY, SELL, DIVIDEND, FEE, INTEREST, TRANSFER, TAX, TAX_ON_DIVIDEND, TAX_ON_INTEREST, STOCK_SPLIT',
      'TAX_ON_DIVIDEND / TAX_ON_INTEREST: tax withheld at source (e.g. US withholding on a dividend). Use a negative total for tax withheld and a positive one for a refund; a file with no negative tax rows has every amount read as tax withheld',
    ],
    info: 'A simplified format that matches the data model used internally by this tool. Use this if your broker isn\'t supported yet, or to manually create test data. Stock Splits: Use STOCK_SPLIT to record corporate actions like 10:1 splits. The tool will automatically adjust your cost basis per HMRC TCGA92/S127 rules.',
  },
  exampleFile: '/examples/generic-example.csv',
  enabled: true,
}
