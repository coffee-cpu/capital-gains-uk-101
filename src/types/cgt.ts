import { z } from 'zod'
import { EnrichedTransaction, GainGroup } from './transaction'

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
  rule: typeof GainGroup[keyof typeof GainGroup]
  /** Total quantity matched under this rule */
  quantityMatched: number
  /** Total cost basis in GBP for the matched quantity */
  totalCostBasisGbp: number
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
  /** Total interest income in GBP */
  totalInterestGbp: number
  /** Number of disposals with incomplete/missing acquisition data */
  incompleteDisposals: number
  /**
   * Tax year-specific feature data.
   * Each feature stores its calculated data under its unique ID.
   * This keeps the core type clean while allowing year-specific extensions.
   *
   * Example: For 2024/25, this may contain:
   * { 'cgt-rate-change-2024': CGTRateChange2024Data }
   */
  features?: Record<string, unknown>
}

/**
 * Complete CGT calculation result
 */
export interface CGTCalculationResult {
  /** All enriched transactions with gain_group populated */
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
}

/**
 * Zod schemas for validation
 */

export const Section104PoolSchema = z.object({
  symbol: z.string(),
  quantity: z.number(),
  totalCostGbp: z.number(),
  averageCostGbp: z.number(),
  history: z.array(z.object({
    date: z.string().date(),
    type: z.enum(['BUY', 'SELL']),
    quantity: z.number(),
    costOrProceeds: z.number(),
    balanceQuantity: z.number(),
    balanceCost: z.number(),
    transactionId: z.string(),
  })),
})

export const DisposalRecordSchema = z.object({
  id: z.string(),
  disposal: z.any(), // EnrichedTransaction
  matchings: z.array(z.any()), // MatchingResult[]
  proceedsGbp: z.number(),
  allowableCostsGbp: z.number(),
  gainOrLossGbp: z.number(),
  taxYear: z.string(),
  unmatchedQuantity: z.number().optional(),
  isIncomplete: z.boolean(),
})

export const TaxYearSummarySchema = z.object({
  taxYear: z.string(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  disposals: z.array(DisposalRecordSchema),
  totalDisposals: z.number().int().nonnegative(),
  totalProceedsGbp: z.number(),
  totalAllowableCostsGbp: z.number(),
  totalGainsGbp: z.number().nonnegative(),
  totalLossesGbp: z.number().nonpositive(),
  netGainOrLossGbp: z.number(),
  annualExemptAmount: z.number().nonnegative(),
  taxableGainGbp: z.number().nonnegative(),
  totalDividends: z.number().int().nonnegative(),
  totalDividendsGbp: z.number().nonnegative(),
  grossDividendsGbp: z.number().nonnegative(),
  totalWithholdingTaxGbp: z.number().nonnegative(),
  dividendAllowance: z.number().nonnegative(),
  totalInterest: z.number().int().nonnegative(),
  totalInterestGbp: z.number().nonnegative(),
  incompleteDisposals: z.number().int().nonnegative(),
})
