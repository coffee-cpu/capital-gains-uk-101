import { EnrichedTransaction, MatchingRule, GenericTransaction } from './transaction'
import type { TaxYearFeaturesMap } from '../lib/cgt/taxYearFeatures/types'

/**
 * CGT Calculation Types
 *
 * These types support HMRC capital gains tax calculations following the official guidance:
 * - Same-day rule: TCGA92/S105(1) - CG51560
 * - 30-day "bed and breakfast" rule: TCGA92/S106A(5) and (5A) - CG51560
 * - Section 104 pooled holdings: TCGA92/S104 - CG51620
 */

/**
 * A matching between a disposal (SELL) and its acquisition (BUY)
 */
export interface MatchingResult {
  /** The disposal transaction being matched */
  disposal: EnrichedTransaction
  /** The acquisition transaction(s) matched against */
  acquisitions: Array<{
    transaction: EnrichedTransaction
    /** Quantity matched (may be partial) */
    quantityMatched: number
    /** Cost basis for the matched portion in GBP (including fees) */
    costBasisGbp: number
  }>
  /** Which HMRC rule was applied */
  rule: MatchingRule
  /** Total quantity matched under this rule */
  quantityMatched: number
  /** Total cost basis in GBP for the matched quantity */
  totalCostBasisGbp: number
  /**
   * True when the matched cost includes an acquisition with no GBP exchange
   * rate (valued at £0). Set by the Section 104 stage when the pool holds such
   * an acquisition; other stages leave it unset.
   */
  missingFx?: boolean
}

/**
 * A complete disposal record showing gain/loss calculation
 */
export interface DisposalRecord {
  /** Unique identifier for this disposal calculation */
  id: string
  /** The disposal transaction */
  disposal: EnrichedTransaction
  /** All matchings that contributed to this disposal */
  matchings: MatchingResult[]
  /** Total proceeds from disposal in GBP */
  proceedsGbp: number
  /** Total allowable costs in GBP (purchase cost + fees) */
  allowableCostsGbp: number
  /** Net gain (positive) or loss (negative) in GBP */
  gainOrLossGbp: number
  /** UK tax year when disposal occurred (e.g., "2023/24") */
  taxYear: string
  /** Quantity that could not be matched to any acquisitions */
  unmatchedQuantity?: number
  /** True if disposal has insufficient acquisition data */
  isIncomplete: boolean
  /**
   * True if the disposal, or an acquisition its cost comes from, has no GBP
   * exchange rate. The missing side is valued at £0, so the gain is wrong.
   */
  missingFx?: boolean
}

/**
 * Section 104 Pool state for a single asset
 *
 * The pool tracks the average cost basis of shares acquired outside
 * of same-day and 30-day matching rules (HMRC CG51620)
 */
export interface Section104Pool {
  /** Asset symbol (e.g., "AAPL") */
  symbol: string
  /** Total quantity of shares in the pool */
  quantity: number
  /** Total cost in GBP (including fees) */
  totalCostGbp: number
  /** Average cost per share in GBP */
  averageCostGbp: number
  /** History of pool operations for audit trail */
  history: Array<{
    date: string
    type: 'BUY' | 'SELL'
    quantity: number
    costOrProceeds: number
    balanceQuantity: number
    balanceCost: number
    transactionId: string
  }>
}

/**
 * Summary of CGT calculations for a tax year
 */
export interface TaxYearSummary {
  /** Tax year label (e.g., "2023/24") */
  taxYear: string
  /** Start date of tax year (inclusive) */
  startDate: string
  /** End date of tax year (inclusive) */
  endDate: string
  /** All disposal records in this tax year */
  disposals: DisposalRecord[]
  /** Total number of disposals */
  totalDisposals: number
  /** Total proceeds from all disposals in GBP */
  totalProceedsGbp: number
  /** Total allowable costs in GBP */
  totalAllowableCostsGbp: number
  /** Total capital gains (sum of positive gains) */
  totalGainsGbp: number
  /** Total capital losses (sum of negative gains) */
  totalLossesGbp: number
  /** Net gain/loss for the tax year */
  netGainOrLossGbp: number
  /** Annual exempt amount for this tax year (from HMRC) */
  annualExemptAmount: number
  /** Taxable gain after applying annual exemption (if positive) */
  taxableGainGbp: number
  /** Total number of dividend transactions */
  totalDividends: number
  /** Total dividend income in GBP (net, after withholding) */
  totalDividendsGbp: number
  /** Total gross dividends in GBP (before withholding tax) - for SA106 */
  grossDividendsGbp: number
  /** Total withholding tax on dividends in GBP - for SA106 */
  totalWithholdingTaxGbp: number
  /** Dividend allowance for this tax year (from HMRC) */
  dividendAllowance: number
  /** Total number of interest transactions */
  totalInterest: number
  /** Total interest income in GBP (net, after withholding) */
  totalInterestGbp: number
  /** Gross interest in GBP (before withholding tax) - for SA106 */
  grossInterestGbp: number
  /** Total withholding tax on interest in GBP - for SA106 */
  interestWithholdingTaxGbp: number
  /** Number of disposals with incomplete/missing acquisition data */
  incompleteDisposals: number
  /** Number of disposals whose gain uses a missing GBP exchange rate */
  missingFxDisposals?: number
  /**
   * Tax year-specific feature data.
   * Each feature stores its calculated data under its unique ID.
   * This keeps the core type clean while allowing year-specific extensions.
   *
   * Example: For 2024/25, this may contain:
   * { 'cgt-rate-change-2024': CGTRateChange2024Data }
   */
  features?: TaxYearFeaturesMap
}

/**
 * Complete CGT calculation result
 */
export interface CGTCalculationResult {
  /** All enriched transactions with match_groups populated */
  transactions: EnrichedTransaction[]
  /** All disposal records across all tax years */
  disposals: DisposalRecord[]
  /** Section 104 pools by symbol */
  section104Pools: Map<string, Section104Pool>
  /** Tax year summaries */
  taxYearSummaries: TaxYearSummary[]
  /** Calculation metadata */
  metadata: {
    calculatedAt: string
    totalTransactions: number
    totalBuys: number
    totalSells: number
  }
  /**
   * Choices the pipeline made about the imported data that change the
   * figures, so they can be shown to the user. Set by runPipeline.
   */
  dataNotices?: DataNotices
}

/**
 * One split record that was set aside because another record of the same
 * split (same symbol, within a few days) gave a different ratio.
 */
export interface SplitConflict {
  symbol: string
  /** The record that was applied (the earliest) */
  used: { id: string; date: string; ratio: string; source: string }
  /** The record that was ignored */
  ignored: { id: string; date: string; ratio: string; source: string }
}

export interface DataNotices {
  /**
   * Rows dropped because an identical row from the same broker appeared in
   * another imported file (see removeOverlappingImports)
   */
  overlappingRows: GenericTransaction[]
  /** Split records for the same split that disagreed on the ratio */
  splitConflicts: SplitConflict[]
  /**
   * Fetched split records dropped as invalid, for symbols the user holds.
   * Each may be a missed split, so quantities from its date may be wrong.
   */
  rejectedSplitRecords?: { symbol: string; date: string; reason: string }[]
  /** Tickers for one ISIN that were given one symbol, so they share a pool */
  symbolMerges?: { isin: string; symbol: string; mergedSymbols: string[] }[]
  /**
   * Tickers seen with more than one ISIN. pooledSeparately: the ISINs
   * overlapped in time, so rows were pooled per ISIN; otherwise one ISIN
   * followed the other and the rows stayed in one pool.
   */
  tickerConflicts?: { symbol: string; isins: string[]; pooledSeparately: boolean }[]
  /**
   * Stock split rows from the user's files with no usable ratio (some
   * exports leave it out, e.g. Trading 212 and Revolut, and Schwab when the
   * description doesn't state it) for shares the user holds, that no other
   * split record covers. They can't be applied, so quantities before and
   * after the split don't line up.
   */
  splitsWithoutRatio?: { id: string; symbol: string; date: string; source: string }[]
  /** Whether community split data was looked up (the auto-splits setting) */
  autoSplits?: boolean
}

