import { EnrichedTransaction } from '../../types/transaction'
import { withheldAmountGbp } from './withholding'

/**
 * Dividend or interest income for one tax year, in GBP, for SA106
 */
export interface IncomeSummary {
  /** Number of income transactions (DIVIDEND or INTEREST rows) */
  count: number
  /** Income before withholding tax */
  grossGbp: number
  /** All tax withheld: on the income rows and in separate TAX_ON_* rows */
  withholdingGbp: number
  /** Gross income less all withholding */
  netGbp: number
}

/**
 * Summarise dividends or interest for one tax year.
 *
 * Withholding comes from two places: `withholdingTax_gbp` on the income row
 * itself (IB, Freetrade), and separate TAX_ON_DIVIDEND / TAX_ON_INTEREST rows
 * (Schwab NRA Tax Adj, IB Foreign Tax Withholding).
 *
 * @param incomeRows DIVIDEND or INTEREST transactions for the year
 * @param taxRows The matching TAX_ON_DIVIDEND or TAX_ON_INTEREST transactions
 * @param grossOf Gross amount of one income row, which brokers report differently
 */
function summarizeIncome(
  incomeRows: EnrichedTransaction[],
  taxRows: EnrichedTransaction[],
  grossOf: (tx: EnrichedTransaction) => number
): IncomeSummary {
  const grossGbp = sum(incomeRows, grossOf)
  const withholdingGbp =
    sum(incomeRows, tx => tx.withholdingTax_gbp ?? 0) + sum(taxRows, withheldAmountGbp)
  return { count: incomeRows.length, grossGbp, withholdingGbp, netGbp: grossGbp - withholdingGbp }
}

/**
 * Dividends: `grossDividend_gbp` when the parser recorded it (IB, Freetrade),
 * otherwise `value_gbp` (Schwab, where the total is the gross amount).
 */
export function summarizeDividends(transactions: EnrichedTransaction[]): IncomeSummary {
  return summarizeIncome(
    transactions.filter(tx => tx.type === 'DIVIDEND'),
    transactions.filter(tx => tx.type === 'TAX_ON_DIVIDEND'),
    tx => tx.grossDividend_gbp ?? tx.value_gbp ?? 0
  )
}

/**
 * Interest: `value_gbp` is net of any withholding the parser already took off
 * (IB, Freetrade), so that withholding is added back for the gross amount.
 */
export function summarizeInterest(transactions: EnrichedTransaction[]): IncomeSummary {
  return summarizeIncome(
    transactions.filter(tx => tx.type === 'INTEREST'),
    transactions.filter(tx => tx.type === 'TAX_ON_INTEREST'),
    tx => (tx.value_gbp || 0) + (tx.withholdingTax_gbp ?? 0)
  )
}

function sum<T>(items: T[], valueOf: (item: T) => number): number {
  return items.reduce((total, item) => total + valueOf(item), 0)
}
