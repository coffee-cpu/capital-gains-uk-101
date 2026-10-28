import { CGTCalculationResult, DisposalRecord, Section104Pool, TaxYearSummary } from '../../../src/types/cgt'
import { FXSource, FXSourceAttributions } from '../../../src/types/fxSource'
import { BrokerType } from '../../../src/types/broker'
import { GainGroupType } from '../../../src/types/transaction'
import { getEffectiveQuantity, QUANTITY_EPSILON } from '../../../src/lib/cgt/utils'
import type { CGTRateChange2024Data } from '../../../src/lib/cgt/taxYearFeatures/cgtRateChange2024'
import { CLI_NAME, CLI_VERSION, DISCLAIMER } from './meta'

/**
 * JSON output contract for `calculate`. Bump SCHEMA_VERSION on any breaking change
 * (removed or renamed fields, changed meaning); adding fields is not breaking.
 */
export const SCHEMA_VERSION = 1

export type MatchRule = 'same-day' | '30-day' | 'section-104' | 'short-sell' | 'none'

export interface ReportWarning {
  code:
    | 'FX_RATE_MISSING'
    | 'INCOMPLETE_DISPOSAL'
    | 'UNKNOWN_TRANSACTION_TYPE'
    | 'DUPLICATE_FILE'
    | 'TAX_YEAR_NOT_FOUND'
  message: string
  transactionIds?: string[]
}

export interface ReportInput {
  file: string
  broker: BrokerType
  transactions: number
}

export interface TaxYearReport {
  taxYear: string
  startDate: string
  endDate: string
  disposals: number
  proceedsGbp: number
  allowableCostsGbp: number
  gainsGbp: number
  /** Positive number: total of the year's losses */
  lossesGbp: number
  netGainOrLossGbp: number
  annualExemptAmountGbp: number
  taxableGainGbp: number
  incompleteDisposals: number
  /** Figures for the SA108 "listed shares and securities" section. Box numbers vary by year, so fields are named, not numbered. */
  sa108: {
    numberOfDisposals: number
    disposalProceedsGbp: number
    allowableCostsGbp: number
    gainsBeforeLossesGbp: number
    lossesGbp: number
  }
  /** 2024/25 only: split around the 30 October 2024 CGT rate change */
  rateChange2024?: {
    rateChangeDate: string
    gainsBeforeGbp: number
    lossesBeforeGbp: number
    netBeforeGbp: number
    gainsAfterGbp: number
    lossesAfterGbp: number
    netAfterGbp: number
    adjustmentRequired: boolean
  }
  dividends: { count: number; grossGbp: number; withholdingTaxGbp: number; netGbp: number; allowanceGbp: number }
  interest: { count: number; grossGbp: number; withholdingTaxGbp: number; netGbp: number }
}

export interface DisposalDetails {
  source: string
  currency: string
  originalQuantity: number | null
  price: number | null
  fxRate: number | null
  fxSource: string
  splitMultiplier: number | null
  matches: Array<{
    rule: MatchRule
    quantity: number
    costGbp: number
    acquisitions: Array<{ transactionId: string; date: string; quantity: number; costGbp: number }>
  }>
  section104Pool: {
    before: { quantity: number; costGbp: number }
    after: { quantity: number; costGbp: number }
  } | null
}

export interface DisposalReport {
  id: string
  date: string
  taxYear: string
  symbol: string
  /** Split-adjusted quantity used for matching */
  quantity: number
  proceedsGbp: number
  allowableCostsGbp: number
  gainOrLossGbp: number
  rules: MatchRule[]
  incomplete: boolean
  unmatchedQuantity?: number
  details?: DisposalDetails
}

export interface PoolReport {
  symbol: string
  quantity: number
  costGbp: number
  averageCostGbp: number
}

export interface CalculateReport {
  schemaVersion: typeof SCHEMA_VERSION
  tool: { name: string; version: string }
  generatedAt: string
  options: {
    taxYear: string | null
    fxSource: FXSource
    fxSourceName: string
    autoSplits: boolean
    offline: boolean
    details: boolean
  }
  inputs: ReportInput[]
  taxYears: TaxYearReport[]
  disposals: DisposalReport[]
  /** Section 104 holdings after the last imported transaction */
  section104Pools: PoolReport[]
  warnings: ReportWarning[]
  disclaimer: string
}

export interface BuildReportOptions {
  taxYear: string | null
  fxSource: FXSource
  autoSplits: boolean
  offline: boolean
  details: boolean
  inputs: ReportInput[]
  /** Warnings raised before calculation (e.g. duplicate files) */
  warnings: ReportWarning[]
}

const RULE_NAMES: Record<GainGroupType, MatchRule> = {
  SAME_DAY: 'same-day',
  '30_DAY': '30-day',
  SECTION_104: 'section-104',
  SHORT_SELL: 'short-sell',
  NONE: 'none',
}

/** Round to pennies, avoiding float noise and negative zero */
export function money(value: number): number {
  const rounded = Math.round(value * 100) / 100
  return rounded === 0 ? 0 : rounded
}

function quantity(value: number): number {
  const rounded = Math.round(value * 1e8) / 1e8
  return rounded === 0 ? 0 : rounded
}

export function buildCalculateReport(
  result: CGTCalculationResult | null,
  options: BuildReportOptions
): CalculateReport {
  const warnings = [...options.warnings]
  const summaries = [...(result?.taxYearSummaries ?? [])]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .filter(s => options.taxYear === null || s.taxYear === options.taxYear)

  if (options.taxYear !== null && summaries.length === 0) {
    warnings.push({
      code: 'TAX_YEAR_NOT_FOUND',
      message: `No transactions fall in tax year ${options.taxYear}.`,
    })
  }

  const reportedYears = new Set(summaries.map(s => s.taxYear))
  const disposals = [...(result?.disposals ?? [])]
    .filter(d => reportedYears.has(d.taxYear))
    .sort((a, b) => a.disposal.date.localeCompare(b.disposal.date) || a.disposal.id.localeCompare(b.disposal.id))

  if (result) {
    warnings.push(...collectWarnings(result, disposals))
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    tool: { name: CLI_NAME, version: CLI_VERSION },
    generatedAt: new Date().toISOString(),
    options: {
      taxYear: options.taxYear,
      fxSource: options.fxSource,
      fxSourceName: FXSourceAttributions[options.fxSource],
      autoSplits: options.autoSplits,
      offline: options.offline,
      details: options.details,
    },
    inputs: options.inputs,
    taxYears: summaries.map(toTaxYearReport),
    disposals: disposals.map(d => toDisposalReport(d, result!.section104Pools, options.details)),
    section104Pools: result ? toPoolReports(result.section104Pools) : [],
    warnings,
    disclaimer: DISCLAIMER,
  }
}

function toTaxYearReport(summary: TaxYearSummary): TaxYearReport {
  const report: TaxYearReport = {
    taxYear: summary.taxYear,
    startDate: summary.startDate,
    endDate: summary.endDate,
    disposals: summary.totalDisposals,
    proceedsGbp: money(summary.totalProceedsGbp),
    allowableCostsGbp: money(summary.totalAllowableCostsGbp),
    gainsGbp: money(summary.totalGainsGbp),
    lossesGbp: money(Math.abs(summary.totalLossesGbp)),
    netGainOrLossGbp: money(summary.netGainOrLossGbp),
    annualExemptAmountGbp: money(summary.annualExemptAmount),
    taxableGainGbp: money(summary.taxableGainGbp),
    incompleteDisposals: summary.incompleteDisposals,
    sa108: {
      numberOfDisposals: summary.totalDisposals,
      disposalProceedsGbp: money(summary.totalProceedsGbp),
      allowableCostsGbp: money(summary.totalAllowableCostsGbp),
      gainsBeforeLossesGbp: money(summary.totalGainsGbp),
      lossesGbp: money(Math.abs(summary.totalLossesGbp)),
    },
    dividends: {
      count: summary.totalDividends,
      grossGbp: money(summary.grossDividendsGbp),
      withholdingTaxGbp: money(summary.totalWithholdingTaxGbp),
      netGbp: money(summary.totalDividendsGbp),
      allowanceGbp: money(summary.dividendAllowance),
    },
    interest: {
      count: summary.totalInterest,
      grossGbp: money(summary.grossInterestGbp),
      withholdingTaxGbp: money(summary.interestWithholdingTaxGbp),
      netGbp: money(summary.totalInterestGbp),
    },
  }

  const rateChange = summary.features?.['cgt-rate-change-2024'] as CGTRateChange2024Data | undefined
  if (rateChange) {
    report.rateChange2024 = {
      rateChangeDate: rateChange.rateChangeDate,
      gainsBeforeGbp: money(rateChange.gainsBeforeRateChange),
      lossesBeforeGbp: money(Math.abs(rateChange.lossesBeforeRateChange)),
      netBeforeGbp: money(rateChange.netGainOrLossBeforeRateChange),
      gainsAfterGbp: money(rateChange.gainsAfterRateChange),
      lossesAfterGbp: money(Math.abs(rateChange.lossesAfterRateChange)),
      netAfterGbp: money(rateChange.netGainOrLossAfterRateChange),
      adjustmentRequired: rateChange.requiresAdjustment,
    }
  }

  return report
}

function toDisposalReport(
  record: DisposalRecord,
  pools: Map<string, Section104Pool>,
  includeDetails: boolean
): DisposalReport {
  const tx = record.disposal
  const rules = [...new Set(record.matchings.map(m => RULE_NAMES[m.rule]))]
  const report: DisposalReport = {
    id: tx.id,
    date: tx.date,
    taxYear: record.taxYear,
    symbol: tx.symbol,
    quantity: quantity(getEffectiveQuantity(tx)),
    proceedsGbp: money(record.proceedsGbp),
    allowableCostsGbp: money(record.allowableCostsGbp),
    gainOrLossGbp: money(record.gainOrLossGbp),
    rules,
    incomplete: record.isIncomplete,
  }
  if (record.unmatchedQuantity && record.unmatchedQuantity > QUANTITY_EPSILON) {
    report.unmatchedQuantity = quantity(record.unmatchedQuantity)
  }
  if (includeDetails) {
    report.details = toDisposalDetails(record, pools.get(tx.symbol))
  }
  return report
}

function toDisposalDetails(record: DisposalRecord, pool: Section104Pool | undefined): DisposalDetails {
  const tx = record.disposal
  const matches = record.matchings.map(m => ({
    rule: RULE_NAMES[m.rule],
    quantity: quantity(m.quantityMatched),
    costGbp: money(m.totalCostBasisGbp),
    // Pool matches are shown by section104Pool rather than a synthetic acquisition
    acquisitions: m.rule === 'SECTION_104' ? [] : m.acquisitions.map(a => ({
      transactionId: a.transaction.id,
      date: a.transaction.date,
      quantity: quantity(a.quantityMatched),
      costGbp: money(a.costBasisGbp),
    })),
  }))

  let section104Pool: DisposalDetails['section104Pool'] = null
  const poolEntry = pool?.history.find(h => h.transactionId === tx.id && h.type === 'SELL')
  if (poolEntry) {
    const poolMatches = record.matchings.filter(m => m.rule === 'SECTION_104')
    const matchedQuantity = poolMatches.reduce((sum, m) => sum + m.quantityMatched, 0)
    const matchedCost = poolMatches.reduce((sum, m) => sum + m.totalCostBasisGbp, 0)
    section104Pool = {
      before: {
        quantity: quantity(poolEntry.balanceQuantity + matchedQuantity),
        costGbp: money(poolEntry.balanceCost + matchedCost),
      },
      after: {
        quantity: quantity(poolEntry.balanceQuantity),
        costGbp: money(poolEntry.balanceCost),
      },
    }
  }

  const multiplier = tx.split_multiplier
  return {
    source: tx.source,
    currency: tx.currency,
    originalQuantity: tx.quantity,
    price: tx.price,
    fxRate: tx.fx_rate,
    fxSource: tx.fx_source,
    splitMultiplier: multiplier !== undefined && multiplier !== 1 ? multiplier : null,
    matches,
    section104Pool,
  }
}

function toPoolReports(pools: Map<string, Section104Pool>): PoolReport[] {
  return [...pools.values()]
    .filter(pool => pool.quantity > QUANTITY_EPSILON)
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .map(pool => ({
      symbol: pool.symbol,
      quantity: quantity(pool.quantity),
      costGbp: money(pool.totalCostGbp),
      averageCostGbp: money(pool.averageCostGbp),
    }))
}

function collectWarnings(result: CGTCalculationResult, disposals: DisposalRecord[]): ReportWarning[] {
  const warnings: ReportWarning[] = []

  // One warning per currency with FX failures, listing the affected transactions
  const fxFailures = new Map<string, { ids: string[]; firstError: string }>()
  for (const tx of result.transactions) {
    if (!tx.fx_error) continue
    const entry = fxFailures.get(tx.currency) ?? { ids: [], firstError: tx.fx_error }
    entry.ids.push(tx.id)
    fxFailures.set(tx.currency, entry)
  }
  for (const [currency, { ids, firstError }] of fxFailures) {
    warnings.push({
      code: 'FX_RATE_MISSING',
      message:
        `No GBP exchange rate for ${ids.length} ${currency} transaction(s), so their GBP values are missing ` +
        `and the totals are wrong. First error: ${firstError}`,
      transactionIds: ids,
    })
  }

  const incomplete = disposals.filter(d => d.isIncomplete)
  if (incomplete.length > 0) {
    warnings.push({
      code: 'INCOMPLETE_DISPOSAL',
      message:
        `${incomplete.length} disposal(s) sell more shares than the imported history shows were acquired, ` +
        'so part of their cost is missing and gains are overstated. Import earlier history, or add the missing ' +
        'acquisitions to a Generic CSV (see the normalize command).',
      transactionIds: incomplete.map(d => d.disposal.id),
    })
  }

  const unknown = result.transactions.filter(tx => tx.type === 'UNKNOWN')
  if (unknown.length > 0) {
    warnings.push({
      code: 'UNKNOWN_TRANSACTION_TYPE',
      message: `${unknown.length} transaction(s) have a type the importer did not recognise and were ignored in the calculation.`,
      transactionIds: unknown.map(tx => tx.id),
    })
  }

  return warnings
}
