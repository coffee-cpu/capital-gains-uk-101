/**
 * CGT Rate Change Feature for Tax Year 2024/25
 *
 * From 30 October 2024, CGT rates changed from 10%/20% to 18%/24%.
 * This feature splits gains/losses into two periods to support accurate
 * Self Assessment reporting via Box 51 adjustment.
 *
 * Reference: https://www.gov.uk/government/publications/changes-to-the-rates-of-capital-gains-tax
 *
 * HMRC SA108 Form Structure:
 * - The form does NOT have separate fields for before/after 30 October disposals
 * - Box 51 ("Adjustment to capital gains tax") is where the adjustment goes
 * - SA system defaults to OLD rates (10%/20%) for entire year
 * - Any disposal on/after 30 Oct requires adjustment if gains > £3,000 AEA
 *
 * This feature provides the data needed to use HMRC's official calculator:
 * https://www.gov.uk/guidance/work-out-your-capital-gains-tax-adjustment-for-the-2024-to-2025-tax-year
 */

import type { TaxYearSummary, DisposalRecord } from '../../../types/cgt'
import type { TaxYearFeature, TaxYearFeatureData } from './types'

/** The date when CGT rates changed (inclusive - disposals ON this date use new rates) */
export const CGT_RATE_CHANGE_DATE = '2024-10-30'

/** Annual Exempt Amount for 2024/25 tax year */
export const AEA_2024_25 = 3000

/** CGT rates before and after the change */
export const CGT_RATES = {
  before: { basic: 10, higher: 20 },
  after: { basic: 18, higher: 24 },
} as const

/**
 * Data produced by the CGT Rate Change 2024 feature.
 */
export interface CGTRateChange2024Data extends TaxYearFeatureData {
  featureId: 'cgt-rate-change-2024'

  /** Date when rates changed */
  rateChangeDate: string

  /** Old CGT rates (before 30 Oct 2024) */
  oldRates: { basic: number; higher: number }

  /** New CGT rates (from 30 Oct 2024) */
  newRates: { basic: number; higher: number }

  /** Total gains from disposals BEFORE 30 October 2024 */
  gainsBeforeRateChange: number

  /** Total losses from disposals BEFORE 30 October 2024 */
  lossesBeforeRateChange: number

  /** Net gain or loss BEFORE 30 October 2024 */
  netGainOrLossBeforeRateChange: number

  /** Number of disposals before rate change */
  disposalCountBeforeRateChange: number

  /** Total gains from disposals ON OR AFTER 30 October 2024 */
  gainsAfterRateChange: number

  /** Total losses from disposals ON OR AFTER 30 October 2024 */
  lossesAfterRateChange: number

  /** Net gain or loss ON OR AFTER 30 October 2024 */
  netGainOrLossAfterRateChange: number

  /** Number of disposals on/after rate change */
  disposalCountAfterRateChange: number

  /**
   * Whether Box 51 adjustment is required.
   *
   * TRUE when BOTH conditions are met:
   * 1. At least one disposal on or after 30 October 2024
   * 2. Total net gain for the year exceeds the Annual Exempt Amount (£3,000)
   *
   * When true, user must use HMRC's calculator to work out the adjustment.
   */
  requiresAdjustment: boolean

  /** Annual Exempt Amount for this tax year */
  annualExemptAmount: number

  /** Total net gain/loss for the entire tax year (for reference) */
  totalNetGainOrLoss: number
}

/**
 * CGT Rate Change Feature for 2024/25
 *
 * This feature only applies to tax year 2024/25 and calculates the split
 * of gains/losses around the 30 October 2024 rate change date.
 */
export const cgtRateChange2024Feature: TaxYearFeature<CGTRateChange2024Data> = {
  id: 'cgt-rate-change-2024',
  name: 'CGT Rate Change (30 October 2024)',
  description:
    'Splits gains/losses into periods before and after the 30 October 2024 CGT rate change for accurate Self Assessment reporting.',

  applies: (taxYear: string): boolean => {
    return taxYear === '2024/25'
  },

  calculate: (
    summary: TaxYearSummary,
    disposals: DisposalRecord[]
  ): CGTRateChange2024Data | null => {
    // Only calculate for 2024/25
    if (summary.taxYear !== '2024/25') {
      return null
    }

    // Split disposals into before/after rate change date
    const disposalsBeforeChange = disposals.filter(
      (d) => d.disposal.date < CGT_RATE_CHANGE_DATE
    )
    const disposalsAfterChange = disposals.filter(
      (d) => d.disposal.date >= CGT_RATE_CHANGE_DATE
    )

    // Calculate totals for before period
    const gainsBeforeRateChange = disposalsBeforeChange
      .filter((d) => d.gainOrLossGbp > 0)
      .reduce((sum, d) => sum + d.gainOrLossGbp, 0)

    const lossesBeforeRateChange = disposalsBeforeChange
      .filter((d) => d.gainOrLossGbp < 0)
      .reduce((sum, d) => sum + d.gainOrLossGbp, 0)

    const netGainOrLossBeforeRateChange = gainsBeforeRateChange + lossesBeforeRateChange

    // Calculate totals for after period
    const gainsAfterRateChange = disposalsAfterChange
      .filter((d) => d.gainOrLossGbp > 0)
      .reduce((sum, d) => sum + d.gainOrLossGbp, 0)

    const lossesAfterRateChange = disposalsAfterChange
      .filter((d) => d.gainOrLossGbp < 0)
      .reduce((sum, d) => sum + d.gainOrLossGbp, 0)

    const netGainOrLossAfterRateChange = gainsAfterRateChange + lossesAfterRateChange

    // Total for the year
    const totalNetGainOrLoss = netGainOrLossBeforeRateChange + netGainOrLossAfterRateChange

    // Determine if Box 51 adjustment is required:
    // 1. At least one disposal on/after 30 Oct
    // 2. Total net gain exceeds AEA (£3,000)
    const hasDisposalsAfterChange = disposalsAfterChange.length > 0
    const requiresAdjustment = hasDisposalsAfterChange && totalNetGainOrLoss > AEA_2024_25

    return {
      featureId: 'cgt-rate-change-2024',
      rateChangeDate: CGT_RATE_CHANGE_DATE,
      oldRates: { ...CGT_RATES.before },
      newRates: { ...CGT_RATES.after },
      gainsBeforeRateChange,
      lossesBeforeRateChange,
      netGainOrLossBeforeRateChange,
      disposalCountBeforeRateChange: disposalsBeforeChange.length,
      gainsAfterRateChange,
      lossesAfterRateChange,
      netGainOrLossAfterRateChange,
      disposalCountAfterRateChange: disposalsAfterChange.length,
      requiresAdjustment,
      annualExemptAmount: AEA_2024_25,
      totalNetGainOrLoss,
    }
  },
}
