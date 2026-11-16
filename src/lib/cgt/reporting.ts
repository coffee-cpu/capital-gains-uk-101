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
