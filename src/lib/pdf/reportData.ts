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
// SA108 figures
// ---------------------------------------------------------------------------

export type Sa108Category = 'LISTED_SHARES' | 'CRYPTO' | 'OPTIONS'

/** Brokers whose exports are cryptoassets. Transactions carry no asset class. */
const CRYPTO_SOURCES = new Set(['Coinbase', 'Coinbase Pro'])

/** Which SA108 section a disposal belongs in, as far as the imported data can tell */
export function sa108Category(tx: EnrichedTransaction): Sa108Category {
  if (tx.underlying_symbol != null) return 'OPTIONS'
  if (CRYPTO_SOURCES.has(tx.source)) return 'CRYPTO'
  return 'LISTED_SHARES'
}

export interface Sa108Boxes {
  number: string
  proceeds: string
  costs: string
  gains: string
  losses: string
}

const LISTED_SHARES_BOXES: Sa108Boxes = { number: '23', proceeds: '24', costs: '25', gains: '26', losses: '27' }
const OTHER_ASSETS_BOXES: Sa108Boxes = { number: '14', proceeds: '15', costs: '16', gains: '17', losses: '19' }
const CRYPTO_BOXES: Sa108Boxes = { number: '13.1', proceeds: '13.2', costs: '13.3', gains: '13.4', losses: '13.5' }

/**
 * SA108 box numbers, checked against HMRC's published forms. HMRC renumbers
 * the form from time to time, so years not listed here print section names
 * only. Cryptoassets had no section of their own before 2024/25 and went in
 * "Other property, assets and gains".
 *
 * Sources: SA108 2024 (2023/24), SA108 2025 (2024/25) and SA108 2026 (2025/26),
 * https://www.gov.uk/government/publications/self-assessment-capital-gains-summary-sa108
 */
const SA108_BOXES: Record<string, { LISTED_SHARES: Sa108Boxes; CRYPTO: Sa108Boxes }> = {
  '2023/24': { LISTED_SHARES: LISTED_SHARES_BOXES, CRYPTO: OTHER_ASSETS_BOXES },
  '2024/25': { LISTED_SHARES: LISTED_SHARES_BOXES, CRYPTO: CRYPTO_BOXES },
  '2025/26': { LISTED_SHARES: LISTED_SHARES_BOXES, CRYPTO: CRYPTO_BOXES },
}

function cryptoSection(taxYear: string): string {
  return parseInt(taxYear.slice(0, 4)) >= 2024 ? 'Cryptoassets' : 'Other property, assets and gains'
}

export interface Sa108Row {
  category: Sa108Category
  /** What the row covers, e.g. "Shares and funds" */
  label: string
  /** SA108 section name, or null when the report doesn't decide it */
  section: string | null
  /** Box numbers, or null when not known for this tax year */
  boxes: Sa108Boxes | null
  /** Same-day disposals of the same asset count once (TCGA92/S105(1)(a)) */
  numberOfDisposals: number
  proceedsGbp: number
  costsGbp: number
  /** Gains in the year, before losses, with same-day disposals of one asset netted */
  gainsGbp: number
  /** Losses in the year, as a positive amount */
  lossesGbp: number
}

const CATEGORY_ORDER: Sa108Category[] = ['LISTED_SHARES', 'CRYPTO', 'OPTIONS']
const CATEGORY_LABELS: Record<Sa108Category, string> = {
  LISTED_SHARES: 'Shares and funds',
  CRYPTO: 'Cryptoassets',
  OPTIONS: 'Options',
}

/** This year's disposals totalled per SA108 section */
export function sa108Rows(taxYear: string, disposals: DisposalRecord[]): Sa108Row[] {
  const boxes = SA108_BOXES[taxYear]
  return CATEGORY_ORDER.flatMap(category => {
    const inCategory = disposals.filter(d => sa108Category(d.disposal) === category)
    if (inCategory.length === 0) return []
    const sum = (f: (d: DisposalRecord) => number) => inCategory.reduce((total, d) => total + f(d), 0)
    // Same-day disposals of one asset are a single disposal (TCGA92/S105(1)(a)),
    // so their gains and losses are netted before splitting into the boxes
    const netByDisposal = new Map<string, number>()
    for (const d of inCategory) {
      const key = `${d.disposal.symbol}|${d.disposal.date}`
      netByDisposal.set(key, (netByDisposal.get(key) ?? 0) + d.gainOrLossGbp)
    }
    const nets = [...netByDisposal.values()]
    return [{
      category,
      label: CATEGORY_LABELS[category],
      section:
        category === 'LISTED_SHARES' ? 'Listed shares and securities'
        : category === 'CRYPTO' ? cryptoSection(taxYear)
        : null,
      boxes: category === 'OPTIONS' || !boxes ? null : boxes[category],
      numberOfDisposals: netByDisposal.size,
      proceedsGbp: sum(d => d.proceedsGbp),
      costsGbp: sum(d => d.allowableCostsGbp),
      gainsGbp: nets.reduce((total, net) => total + Math.max(0, net), 0),
      lossesGbp: nets.reduce((total, net) => total + Math.max(0, -net), 0),
    }]
  })
}

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
