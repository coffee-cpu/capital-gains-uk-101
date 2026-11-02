import type { DisposalRecord, Section104Pool, TaxYearSummary } from '../../types/cgt'
import type { EnrichedTransaction } from '../../types/transaction'
import { isAcquisition, isDisposal, QUANTITY_EPSILON } from '../cgt/utils'
import { withheldAmountGbp } from '../cgt/engine'

/**
 * Figures for the PDF report that the CGT engine doesn't produce itself.
 * Pure functions with no React or browser dependencies, so they are shared by
 * the web app and the CLI and can be tested on their own.
 */

const INCOME_TYPES = new Set<string>(['DIVIDEND', 'INTEREST', 'TAX_ON_DIVIDEND', 'TAX_ON_INTEREST'])

export interface ReportDataIssues {
  /** Transactions with no GBP exchange rate that feed this year's figures, by currency */
  missingFx: Array<{ currency: string; count: number }>
  /** Disposals in the year that could not be fully matched to acquisitions */
  incompleteDisposals: DisposalRecord[]
}

/**
 * Problems in the imported data that make this year's report wrong or
 * incomplete. A missing FX rate counts for a trade up to the year end in an
 * asset disposed of this year (earlier trades feed its Section 104 pool cost),
 * for any acquisition matched to this year's disposals (a 30-day buy-back can
 * fall after the year end), and for income within the year.
 */
export function findReportDataIssues(
  taxYearSummary: TaxYearSummary,
  disposals: DisposalRecord[],
  transactions: EnrichedTransaction[]
): ReportDataIssues {
  const disposedSymbols = new Set(disposals.map(d => d.disposal.symbol))
  const counts = new Map<string, number>()
  const seen = new Set<string>()
  const add = (tx: EnrichedTransaction) => {
    if (seen.has(tx.id)) return
    seen.add(tx.id)
    counts.set(tx.currency, (counts.get(tx.currency) ?? 0) + 1)
  }
  for (const tx of transactions) {
    if (tx.ignored || !tx.fx_error || tx.date > taxYearSummary.endDate) continue
    const affectsGains = (isAcquisition(tx) || isDisposal(tx)) && disposedSymbols.has(tx.symbol)
    const affectsIncome = INCOME_TYPES.has(tx.type) && tx.date >= taxYearSummary.startDate
    if (affectsGains || affectsIncome) add(tx)
  }
  // Acquisitions matched to this year's disposals, including 30-day
  // buy-backs that fall after the year end
  for (const d of disposals) {
    for (const m of d.matchings) {
      for (const acq of m.acquisitions) {
        if (acq.transaction.fx_error && !acq.transaction.ignored) add(acq.transaction)
      }
    }
  }
  return {
    missingFx: [...counts].map(([currency, count]) => ({ currency, count })),
    incompleteDisposals: disposals.filter(d => d.isIncomplete),
  }
}

/** True when the disposal or any acquisition matched against it has no GBP rate */
export function hasMissingFx(disposal: DisposalRecord): boolean {
  return (
    !!disposal.disposal.fx_error ||
    disposal.matchings.some(m => m.acquisitions.some(acq => !!acq.transaction.fx_error))
  )
}

// ---------------------------------------------------------------------------
// SA108 figures (shared with the CLI and the engine, see cgt/sa108.ts)
// ---------------------------------------------------------------------------

export { sa108Category, sa108Rows } from '../cgt/sa108'
export type { Sa108Category, Sa108Boxes, Sa108Row } from '../cgt/sa108'

// ---------------------------------------------------------------------------
// Dividend income
// ---------------------------------------------------------------------------

export interface DividendLine {
  symbol: string
  /** Gross dividends in GBP, before tax withheld */
  grossGbp: number
  /** Tax withheld at source in GBP */
  withheldGbp: number
}

/**
 * Dividends in the tax year per symbol, so the user can split UK from foreign
 * ones. Uses the engine's sums, so the lines add up to the summary totals.
 */
export function dividendLines(taxYearSummary: TaxYearSummary, transactions: EnrichedTransaction[]): DividendLine[] {
  const bySymbol = new Map<string, DividendLine>()
  const line = (symbol: string) => {
    let entry = bySymbol.get(symbol)
    if (!entry) {
      entry = { symbol, grossGbp: 0, withheldGbp: 0 }
      bySymbol.set(symbol, entry)
    }
    return entry
  }
  for (const tx of transactions) {
    if (tx.ignored || tx.tax_year !== taxYearSummary.taxYear) continue
    if (tx.type === 'DIVIDEND') {
      const entry = line(tx.symbol)
      entry.grossGbp += tx.grossDividend_gbp ?? tx.value_gbp ?? 0
      entry.withheldGbp += tx.withholdingTax_gbp ?? 0
    } else if (tx.type === 'TAX_ON_DIVIDEND') {
      line(tx.symbol).withheldGbp += withheldAmountGbp(tx)
    }
  }
  return [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol))
}

// ---------------------------------------------------------------------------
// Section 104 pools at the year end
// ---------------------------------------------------------------------------

export interface PoolBalance {
  symbol: string
  quantity: number
  costGbp: number
}

/**
 * Each Section 104 pool's holding at the end of the tax year, from the pool
 * history. Quantities are in the same split-adjusted units the engine uses.
 */
export function poolBalancesAt(pools: Map<string, Section104Pool> | undefined, endDate: string): PoolBalance[] {
  if (!pools) return []
  const balances: PoolBalance[] = []
  for (const pool of pools.values()) {
    let last: Section104Pool['history'][number] | undefined
    for (const entry of pool.history) {
      if (entry.date <= endDate && (!last || entry.date >= last.date)) last = entry
    }
    if (last && last.balanceQuantity > QUANTITY_EPSILON) {
      balances.push({ symbol: pool.symbol, quantity: last.balanceQuantity, costGbp: last.balanceCost })
    }
  }
  return balances.sort((a, b) => a.symbol.localeCompare(b.symbol))
}

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

/**
 * Exchange-rate sources behind this year's figures: the disposals, the
 * acquisitions matched to them, and the year's income. GBP rows are left out.
 */
export function fxSourcesUsed(
  taxYearSummary: TaxYearSummary,
  disposals: DisposalRecord[],
  transactions: EnrichedTransaction[]
): string[] {
  const sources = new Set<string>()
  const add = (tx: EnrichedTransaction) => {
    if (tx.fx_source && tx.currency !== 'GBP') sources.add(tx.fx_source)
  }
  for (const d of disposals) {
    add(d.disposal)
    for (const m of d.matchings) for (const acq of m.acquisitions) add(acq.transaction)
  }
  for (const tx of transactions) {
    if (!tx.ignored && tx.tax_year === taxYearSummary.taxYear && INCOME_TYPES.has(tx.type)) add(tx)
  }
  return [...sources].sort()
}
