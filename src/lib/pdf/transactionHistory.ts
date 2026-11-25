import type { DisposalRecord, TaxYearSummary } from '../../types/cgt'
import type { EnrichedTransaction } from '../../types/transaction'
import { formatGbp } from '../../utils/currency'
import { formatIsoDate } from '../../utils/date'
import { feeCurrency, isFiatCurrency } from '../currencies'

/**
 * The PDF report's options and transaction history table, without the
 * document itself. The export button imports these up front (for its menu
 * and row counts); the document and @react-pdf/renderer load only when a
 * report is made.
 */

/**
 * The transaction history appendix: none, the selected tax year's
 * transactions, or every transaction from the first import to the year end
 */
export type TransactionHistoryScope = 'none' | 'tax-year' | 'all'

export const TRANSACTION_HISTORY_SCOPES: readonly TransactionHistoryScope[] = ['none', 'tax-year', 'all']

export function isTransactionHistoryScope(value: unknown): value is TransactionHistoryScope {
  return TRANSACTION_HISTORY_SCOPES.includes(value as TransactionHistoryScope)
}

/**
 * Acquisitions after the year end that a disposal in the year was matched to
 * (30-day rule, TCGA92/S106A(5), or a short sale's covering buy). They set
 * that disposal's cost, so the appendix lists them too.
 */
export function laterMatchedAcquisitionIds(
  disposals: DisposalRecord[],
  taxYearSummary: Pick<TaxYearSummary, 'endDate'>
): Set<string> {
  const ids = new Set<string>()
  for (const disposal of disposals) {
    for (const matching of disposal.matchings) {
      for (const { transaction } of matching.acquisitions) {
        if (transaction.date > taxYearSummary.endDate) ids.add(transaction.id)
      }
    }
  }
  return ids
}

/**
 * The rows of the transaction history appendix, oldest first: transactions that
 * aren't ignored, within the scope, and not cash rows with nothing in them, plus
 * any later acquisitions that the year's disposals were matched to
 */
export function transactionHistoryRows(
  transactions: EnrichedTransaction[],
  taxYearSummary: Pick<TaxYearSummary, 'startDate' | 'endDate'>,
  scope: TransactionHistoryScope,
  disposals: DisposalRecord[] = []
): EnrichedTransaction[] {
  if (scope === 'none') return []
  const laterMatched = laterMatchedAcquisitionIds(disposals, taxYearSummary)
  return transactions
    .filter(tx =>
      !tx.ignored &&
      ((tx.date <= taxYearSummary.endDate && (scope === 'all' || tx.date >= taxYearSummary.startDate)) ||
        laterMatched.has(tx.id)) &&
      transactionTableCells(tx) !== null
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol))
}

/** Format an ISO date (YYYY-MM-DD) as DD/MM/YYYY */
export function formatReportDate(date: string): string {
  return formatIsoDate(date, 'numeric')
}

/**
 * Format a share/unit quantity: thousands separators, up to 8 decimal places
 * (crypto), no trailing zeros. 0.0086629 stays 0.0086629 rather than 0.01.
 */
export function formatQuantity(value: number): string {
  return value.toLocaleString('en-GB', { maximumFractionDigits: 8 })
}

/** OPTIONS_BUY_TO_OPEN → "Options buy to open", TAX_ON_DIVIDEND → "Tax on dividend" */
export function formatTransactionType(type: string): string {
  const words = type.toLowerCase().replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Cash movements: their amount is the value, and a quantity or price would be noise */
const CASH_ONLY_TYPES = new Set(['DIVIDEND', 'INTEREST', 'TAX', 'TAX_ON_DIVIDEND', 'TAX_ON_INTEREST', 'FEE'])

/** For money: under half a penny rounds to £0.00 */
const isZero = (value: number | null | undefined) => value == null || Math.abs(value) < 0.005

/**
 * The cells of one row in the transaction history table, or null for a cash row
 * with nothing to show (a £0.00 amount and no fee, such as a £0.00 tax line).
 * Other rows, such as a stock split with no amounts, are always kept.
 * Quantities are shown without sign, as the type already says the direction
 * (an expired option is "1", not "-1.00").
 */
export function transactionTableCells(tx: EnrichedTransaction): {
  symbol: string
  quantity: string
  price: string
  value: string
  fee: string
  /** The broker's own amounts, for a row in another currency */
  original?: { price: string; value: string; fee: string }
  /** Units of the row's currency per £1 ("1.2500 USD"), for a row in another currency */
  fxRate?: string
} | null {
  const cashOnly = CASH_ONLY_TYPES.has(tx.type)
  // The broker's own amounts, so a row whose GBP value is missing (no FX rate) is kept
  if (cashOnly && isZero(tx.total) && isZero(tx.fee)) return null
  // Quantities are compared exactly: 0.001 BTC is not zero
  const quantity = !cashOnly && tx.quantity ? Math.abs(tx.quantity) : null
  const cells = {
    symbol: tx.symbol || '-',
    quantity: quantity == null ? '-' : formatQuantity(quantity),
    price: cashOnly || tx.price_gbp == null ? '-' : formatGbp(tx.price_gbp),
    value: tx.value_gbp == null ? '-' : formatGbp(tx.value_gbp),
    fee: isZero(tx.fee_gbp) ? '-' : formatGbp(tx.fee_gbp!),
  }
  if (!tx.currency || tx.currency.toUpperCase() === 'GBP') return cells
  return {
    ...cells,
    original: {
      price: cashOnly || tx.price == null ? '-' : formatOriginalAmount(tx.price, tx.currency, PRICE_DECIMALS),
      value: tx.total == null ? '-' : formatOriginalAmount(tx.total, tx.currency),
      fee: isZero(tx.fee) ? '-' : formatOriginalAmount(tx.fee!, feeCurrency(tx)),
    },
    fxRate: tx.fx_rate == null ? '-' : `${formatFxRate(tx.fx_rate)} ${tx.currency.toUpperCase()}`,
  }
}

/** Up to this many decimal places for an original-currency price */
const PRICE_DECIMALS = 6

/**
 * An amount in its original currency, with the currency code rather than a
 * symbol (the PDF's built-in font has no glyphs for symbols such as ₹):
 * "1,234.50 USD". Negatives use brackets, like the GBP figures. Fiat amounts
 * keep at least 2 decimal places and up to `maxDecimals` (more for a price,
 * so a penny stock's 0.0045 USD isn't shown as 0.00); crypto keeps up to 8.
 */
export function formatOriginalAmount(amount: number, currency: string, maxDecimals = 2): string {
  const code = currency.toUpperCase()
  const abs = Math.abs(amount)
  const number = isFiatCurrency(code)
    ? abs.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: Math.max(2, maxDecimals) })
    : formatQuantity(abs)
  // Amounts that round to zero (including -0) are shown without brackets
  const isNegative = amount < 0 && number.replace(/[0.,]/g, '') !== ''
  return isNegative ? `(${number} ${code})` : `${number} ${code}`
}

/** An FX rate (units of the currency per £1) to 4 decimal places */
export function formatFxRate(rate: number): string {
  return rate.toLocaleString('en-GB', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

/** File name used for a tax year's report, e.g. CGT-Report-2024-25.pdf */
export function pdfReportFileName(taxYear: string): string {
  return `CGT-Report-${taxYear.replace('/', '-')}.pdf`
}
