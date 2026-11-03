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
 * - An adjustment is needed only when gains on/after 30 Oct remain chargeable
 *   after the year's losses and the AEA are set against them first, the most
 *   beneficial order (TCGA92/S4B)
 *
 * This feature provides the data needed to use HMRC's official calculator:
 * https://www.gov.uk/guidance/work-out-your-capital-gains-tax-adjustment-for-the-2024-to-2025-tax-year
 */

import type { TaxYearSummary, DisposalRecord } from '../../../types/cgt'
import type { TaxYearFeature, TaxYearFeatureData } from './types'
import { getAnnualExemptAmount } from '../allowances'
import { netSameDayGains, splitGainsAndLosses } from '../sa108'

/** The date when CGT rates changed (inclusive - disposals ON this date use new rates) */
export const CGT_RATE_CHANGE_DATE = '2024-10-30'

/** Annual Exempt Amount for 2024/25 tax year */
export const AEA_2024_25 = getAnnualExemptAmount('2024/25')

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
   * Gains on or after 30 October 2024 still chargeable after the year's losses
   * and the Annual Exempt Amount are set against them first. TCGA92/S4B lets
   * losses and the AEA go wherever they are most beneficial, which is against
   * the gains taxed at the higher, new rates.
   */
  chargeableGainsAfterRateChange: number

  /**
   * Whether Box 51 adjustment is required: some gains on or after 30 October
   * 2024 remain chargeable after losses and the AEA (chargeableGainsAfterRateChange > 0).
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

    // Same-day disposals of one asset are a single disposal with one net
    // gain or loss (TCGA92/S105(1)(a)), as in the year totals. They always
    // fall in the same period, so each period is netted on its own.
    const netsBefore = netSameDayGains(disposalsBeforeChange)
    const netsAfter = netSameDayGains(disposalsAfterChange)
    const before = splitGainsAndLosses(netsBefore)
    const after = splitGainsAndLosses(netsAfter)

    // Calculate totals for before period (losses as a negative amount)
    const gainsBeforeRateChange = before.gainsGbp
    const lossesBeforeRateChange = -before.lossesGbp || 0

    const netGainOrLossBeforeRateChange = gainsBeforeRateChange + lossesBeforeRateChange

    // Calculate totals for after period
    const gainsAfterRateChange = after.gainsGbp
    const lossesAfterRateChange = -after.lossesGbp || 0

    const netGainOrLossAfterRateChange = gainsAfterRateChange + lossesAfterRateChange

    // Total for the year
    const totalNetGainOrLoss = netGainOrLossBeforeRateChange + netGainOrLossAfterRateChange

    // Box 51 adjustment is needed only when gains taxed at the new rates are
    // left after relief. The year's losses (from either period) and the AEA
    // are set against post-change gains first, the most beneficial order
    // (TCGA92/S4B), so only what remains after them is chargeable at the new
    // rates.
    const totalLosses = -(lossesBeforeRateChange + lossesAfterRateChange)
    const chargeableGainsAfterRateChange = Math.max(0, gainsAfterRateChange - totalLosses - AEA_2024_25)
    const requiresAdjustment = chargeableGainsAfterRateChange > 0

    return {
      featureId: 'cgt-rate-change-2024',
      rateChangeDate: CGT_RATE_CHANGE_DATE,
      oldRates: { ...CGT_RATES.before },
      newRates: { ...CGT_RATES.after },
      gainsBeforeRateChange,
      lossesBeforeRateChange,
      netGainOrLossBeforeRateChange,
      disposalCountBeforeRateChange: netsBefore.length,
      gainsAfterRateChange,
      lossesAfterRateChange,
      netGainOrLossAfterRateChange,
      disposalCountAfterRateChange: netsAfter.length,
      chargeableGainsAfterRateChange,
      requiresAdjustment,
      annualExemptAmount: AEA_2024_25,
      totalNetGainOrLoss,
    }
  },
}
