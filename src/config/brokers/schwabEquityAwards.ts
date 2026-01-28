import { BrokerType } from '../../types/broker'
import { BrokerDefinition } from '../../types/brokerDefinition'
import { normalizeSchwabEquityAwardsTransactions } from '../../lib/parsers/schwabEquityAwards'

export const schwabEquityAwardsDefinition: BrokerDefinition = {
  type: BrokerType.SCHWAB_EQUITY_AWARDS,
  displayName: 'Charles Schwab Equity Awards',
  shortId: 'schwab-equity',
  detection: {
    requiredHeaders: ['Date', 'Action', 'Symbol', 'FairMarketValuePrice', 'NetSharesDeposited', 'AwardDate'],
    // Higher priority (lower number) than regular Schwab since it has more specific headers
    priority: 10,
  },
  parser: normalizeSchwabEquityAwardsTransactions,
  instructions: {
    steps: [
      'Log into schwab.com → Accounts → Transaction History',
      'Select "Other Accounts" → "Equity Award Center" from dropdown',
      'Select your account and date range (max 4 years)',
      'Click Export → CSV',
    ],
    notes: ['Schwab limits downloads to 4 years. For longer history, download in 4-year chunks and upload multiple files.'],
    warning: 'Equity Awards files only contain acquisitions (RSU vests). You must also upload "Transactions" history from Charles Schwab to include disposals (sales) for CGT calculations.',
  },
  exampleFile: '/examples/schwab-equity-awards-example.csv',
  enabled: true,
}
