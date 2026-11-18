import type { TaxYearSummary } from '../../types/cgt'
import { getAnnualExemptAmount } from './allowances'

/**
 * When the capital gains pages (SA108) of a Self Assessment return are needed,
 * which is not the same as when Capital Gains Tax is due.
 *
 * Source: HMRC "Capital Gains Tax summary notes" (SA108 Notes) 2023-24,
 * 2024-25 and 2025-26, page CGN 1: fill in the pages if
 * - you sold or disposed of chargeable assets worth more than £50,000
 * - your chargeable gains before taking off any losses were more than the
 *   annual exempt amount
 * - you want to claim an allowable capital loss (or make another claim)
 * Before 2023-24 the proceeds limit was 4 times the annual exempt amount
 * (Finance Act 2023 changed TMA 1970 s8C to a fixed £50,000).
 * https://www.gov.uk/government/publications/self-assessment-capital-gains-summary-sa108
 */

/** First tax year (start year) with the fixed £50,000 proceeds limit */
const FIXED_PROCEEDS_LIMIT_FROM = 2023
const FIXED_PROCEEDS_LIMIT = 50_000

/** Disposal proceeds above which the SA108 pages are needed, for a tax year */
export function getReportingProceedsLimit(taxYear: string): number {
  const startYear = parseInt(taxYear.split('/')[0])
  return startYear >= FIXED_PROCEEDS_LIMIT_FROM
    ? FIXED_PROCEEDS_LIMIT
    : 4 * getAnnualExemptAmount(taxYear)
}

export interface Sa108ReportingNeed {
  /** Capital Gains Tax is due: the net gain is above the annual exempt amount */
  taxDue: boolean
  /** Proceeds are above the reporting limit (on the disposals imported) */
  proceedsOverLimit: boolean
  /** Gains before losses are above the annual exempt amount */
  gainsOverExemptAmount: boolean
  /** There is a net loss that can be claimed to use against later gains */
  hasLossToClaim: boolean
  /**
   * Some disposals are unmatched or have no exchange rate, so they count at
   * £0: proceeds and gains are understated and the checks above can pass
   * when they shouldn't
   */
  figuresIncomplete: boolean
  proceedsLimit: number
}

/**
 * Whether this year's disposals put the SA108 pages on the return.
 *
 * Only knows the disposals that were imported: other assets sold in the year
 * count towards the same limits.
 */
export function sa108ReportingNeed(
  summary: Pick<
    TaxYearSummary,
    'taxYear' | 'totalProceedsGbp' | 'totalGainsGbp' | 'netGainOrLossGbp' | 'annualExemptAmount' | 'taxableGainGbp'
  > & Partial<Pick<TaxYearSummary, 'incompleteDisposals' | 'missingFxDisposals'>>
): Sa108ReportingNeed {
  const proceedsLimit = getReportingProceedsLimit(summary.taxYear)
  return {
    taxDue: summary.taxableGainGbp > 0,
    proceedsOverLimit: summary.totalProceedsGbp > proceedsLimit,
    gainsOverExemptAmount: summary.totalGainsGbp > summary.annualExemptAmount,
    hasLossToClaim: summary.netGainOrLossGbp < 0,
    figuresIncomplete: (summary.incompleteDisposals ?? 0) > 0 || (summary.missingFxDisposals ?? 0) > 0,
    proceedsLimit,
  }
}

/**
 * Small foreign dividends can go on the main return (SA100 box 6, "Foreign
 * dividends (up to £X)") instead of the Foreign pages (SA106), as the amount
 * after foreign tax with the tax in box 7. The SA150 notes (2026) allow it when
 * the only other foreign income is untaxed interest in box 3 and total
 * dividends, UK and foreign, are within the limit; otherwise, and to claim
 * Foreign Tax Credit Relief, use the Foreign pages.
 *
 * Only years checked against HMRC's forms are listed (SA100 2024: £1,000;
 * SA100 2025 and 2026: £500). The limit has changed often (£300 on SA100
 * 2016), so other years return null rather than a guess.
 * https://www.gov.uk/government/publications/self-assessment-tax-return-sa100
 */
const SA100_FOREIGN_DIVIDENDS_LIMITS: Record<string, number> = {
  '2023/24': 1000,
  '2024/25': 500,
  '2025/26': 500,
}

/** The SA100 box 6 foreign dividends limit for a tax year, or null when not checked */
export function getSa100ForeignDividendsLimit(taxYear: string): number | null {
  return SA100_FOREIGN_DIVIDENDS_LIMITS[taxYear] ?? null
}

/** The latest tax year with a checked SA100 box 6 limit, and that limit */
export function getLatestSa100ForeignDividendsLimit(): { taxYear: string; limit: number } {
  const taxYear = Object.keys(SA100_FOREIGN_DIVIDENDS_LIMITS).sort().at(-1)!
  return { taxYear, limit: SA100_FOREIGN_DIVIDENDS_LIMITS[taxYear] }
}
