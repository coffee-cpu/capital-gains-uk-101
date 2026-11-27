import { CGTCalculationResult, DisposalRecord, Section104Pool, TaxYearSummary } from '../../../src/types/cgt'
import { FXSource, FXSourceAttributions } from '../../../src/types/fxSource'
import { BrokerType } from '../../../src/types/broker'
import { MatchingRule } from '../../../src/types/transaction'
import { getEffectiveQuantity, QUANTITY_EPSILON } from '../../../src/lib/cgt/utils'
import { sa108Rows, Sa108Category, Sa108Row } from '../../../src/lib/cgt/sa108'
import { combineFxAttributions } from '../../../src/lib/fx/attribution'
import { findDataIssues, DataIssueCode } from '../../../src/lib/issues'
import { SkippedRow } from '../../../src/types/brokerDefinition'
import { HMRC_RULES_CHECK_DATE } from '../../../src/lib/cgt/hmrcRulesCheck'
import { lastConfirmedTaxYear } from '../../../src/lib/freshness'
import { CLI_NAME, CLI_VERSION, DISCLAIMER, RULES_CHECK_ABOUT } from './meta'

/**
 * JSON output contract for `calculate`. Bump SCHEMA_VERSION on any breaking change
 * (removed or renamed fields, changed meaning); adding fields is not breaking.
 */
export const SCHEMA_VERSION = 1

export type MatchRule = 'same-day' | '30-day' | 'section-104' | 'short-sell'

export interface ReportWarning {
  code:
    // Data issues, shared with the web app's Issues panel (src/lib/issues.ts)
    | DataIssueCode
    // About the command's arguments
    | 'DUPLICATE_FILE'
    | 'TAX_YEAR_NOT_FOUND'
  message: string
  /** One line per affected item worth naming, e.g. each currency with missing rates */
  details?: string[]
  transactionIds?: string[]
}

/** A warning as text: the message, then each detail line indented beneath it */
export function warningLines(warning: ReportWarning, prefix: string, detailIndent: string): string[] {
  return [`${prefix}${warning.message}`, ...(warning.details ?? []).map(line => `${detailIndent}${line}`)]
}

export interface ReportInput {
  file: string
  broker: BrokerType
  transactions: number
}

export interface Sa108Figures {
  /** Same-day disposals of one asset count once (TCGA92/S105(1)(a)) */
  numberOfDisposals: number
  /** Gross proceeds, before selling fees */
  disposalProceedsGbp: number
  /** Acquisition costs plus buying and selling fees */
  allowableCostsGbp: number
  gainsBeforeLossesGbp: number
  lossesGbp: number
}

export interface Sa108SectionReport extends Sa108Figures {
  category: 'listed-shares' | 'crypto' | 'options'
  /** SA108 section name, or null when it depends on the contract (options) */
  section: string | null
  /** Box numbers for this tax year's form, or null when not known */
  boxes: { number: string; proceeds: string; costs: string; gains: string; losses: string } | null
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
  /**
   * Figures for the SA108 "listed shares and securities" section only (zero when there are none).
   * Box numbers vary by year, so fields are named, not numbered.
   */
  sa108: Sa108Figures
  /** Every SA108 section with disposals this year: listed shares, cryptoassets, and options (section left to the user) */
  sa108Sections: Sa108SectionReport[]
  /** 2024/25 only: split around the 30 October 2024 CGT rate change */
  rateChange2024?: {
    rateChangeDate: string
    gainsBeforeGbp: number
    lossesBeforeGbp: number
    netBeforeGbp: number
    gainsAfterGbp: number
    lossesAfterGbp: number
    netAfterGbp: number
    /** Gains from 30 Oct 2024 still chargeable after the year's losses and the AEA are set against them first */
    chargeableGainsAfterGbp: number
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
  /** True when the gain uses a missing GBP exchange rate (valued at £0) */
  missingFx?: boolean
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
  /** The project's own check of the rules and allowances (docs/HMRC_RULES_CHECK.md), not HMRC's */
  rulesCheck: {
    lastCheckedOn: string
    /** The last tax year the check confirms: the last one to have ended by lastCheckedOn */
    upToDateForTaxYearsThrough: string
    about: string
  }
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
  /** Rows each input file's parser left out */
  skippedRows?: { file: string; rows: SkippedRow[] }[]
  /** Input file paths by file ID, to name files in warnings */
  fileNames?: ReadonlyMap<string, string>
}

const RULE_NAMES: Record<MatchingRule, MatchRule> = {
  SAME_DAY: 'same-day',
  '30_DAY': '30-day',
  SECTION_104: 'section-104',
  SHORT_SELL: 'short-sell',
}

/**
 * The rate source as the transactions' own fxSource strings name it, combined
 * into one label (e.g. "HMRC Monthly Exchange Rates (2015-2020 archive and
 * gov.uk)"), so it matches them. The plain name when no rate was needed.
 */
function fxSourceName(result: CGTCalculationResult | null, fxSource: FXSource): string {
  const used = (result?.transactions ?? [])
    .filter(tx => tx.currency !== 'GBP' && tx.fx_source && !tx.fx_error)
    .map(tx => tx.fx_source!)
  return used.length > 0 ? combineFxAttributions(used).join(', ') : FXSourceAttributions[fxSource]
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

  // The same issues the web app's Issues panel shows, with the CLI's remedy
  for (const issue of findDataIssues({
    transactions: result?.transactions ?? [],
    disposals,
    dataNotices: result?.dataNotices,
    metadata: result?.metadata,
    skippedRows: options.skippedRows,
    fileNames: options.fileNames,
  })) {
    warnings.push({
      code: issue.code,
      message: issue.remedy ? `${issue.description} ${issue.remedy.cli}` : issue.description,
      ...(issue.details && issue.details.length > 0 && { details: issue.details }),
      ...(issue.transactionIds && { transactionIds: issue.transactionIds }),
    })
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    tool: { name: CLI_NAME, version: CLI_VERSION },
    generatedAt: new Date().toISOString(),
    rulesCheck: {
      lastCheckedOn: HMRC_RULES_CHECK_DATE,
      upToDateForTaxYearsThrough: lastConfirmedTaxYear(),
      about: RULES_CHECK_ABOUT,
    },
    options: {
      taxYear: options.taxYear,
      fxSource: options.fxSource,
      fxSourceName: fxSourceName(result, options.fxSource),
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

const SA108_CATEGORY_NAMES: Record<Sa108Category, Sa108SectionReport['category']> = {
  LISTED_SHARES: 'listed-shares',
  CRYPTO: 'crypto',
  OPTIONS: 'options',
}

const EMPTY_SA108: Sa108Figures = {
  numberOfDisposals: 0,
  disposalProceedsGbp: 0,
  allowableCostsGbp: 0,
  gainsBeforeLossesGbp: 0,
  lossesGbp: 0,
}

function toSa108Figures(row: Sa108Row): Sa108Figures {
  return {
    numberOfDisposals: row.numberOfDisposals,
    disposalProceedsGbp: money(row.proceedsGbp),
    allowableCostsGbp: money(row.costsGbp),
    gainsBeforeLossesGbp: money(row.gainsGbp),
    lossesGbp: money(row.lossesGbp),
  }
}

function toTaxYearReport(summary: TaxYearSummary): TaxYearReport {
  // Same rows as the PDF report's SA108 table
  const rows = sa108Rows(summary.taxYear, summary.disposals)
  const listedShares = rows.find(row => row.category === 'LISTED_SHARES')
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
    sa108: listedShares ? toSa108Figures(listedShares) : EMPTY_SA108,
    sa108Sections: rows.map(row => ({
      category: SA108_CATEGORY_NAMES[row.category],
      section: row.section,
      boxes: row.boxes,
      ...toSa108Figures(row),
    })),
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

  const rateChange = summary.features?.['cgt-rate-change-2024']
  if (rateChange) {
    report.rateChange2024 = {
      rateChangeDate: rateChange.rateChangeDate,
      gainsBeforeGbp: money(rateChange.gainsBeforeRateChange),
      lossesBeforeGbp: money(Math.abs(rateChange.lossesBeforeRateChange)),
      netBeforeGbp: money(rateChange.netGainOrLossBeforeRateChange),
      gainsAfterGbp: money(rateChange.gainsAfterRateChange),
      lossesAfterGbp: money(Math.abs(rateChange.lossesAfterRateChange)),
      netAfterGbp: money(rateChange.netGainOrLossAfterRateChange),
      chargeableGainsAfterGbp: money(rateChange.chargeableGainsAfterRateChange),
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
  if (record.missingFx) {
    report.missingFx = true
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
