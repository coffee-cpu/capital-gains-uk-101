/**
 * Tax Year Features Registry
 *
 * Central registry for all tax year-specific features.
 * Features registered here are applied to relevant tax years during CGT
 * calculation. To add a feature, see TaxYearFeatureDataById in ./types.
 */

import type { TaxYearSummary, DisposalRecord } from '../../../types/cgt'
import type { TaxYearFeature, TaxYearFeatureData, TaxYearFeatureDataById, TaxYearFeatureId, TaxYearFeaturesMap } from './types'
import { cgtRateChange2024Feature } from './cgtRateChange2024'

/** Every feature, by ID; the type requires one entry per TaxYearFeatureId */
const TAX_YEAR_FEATURES: { [K in TaxYearFeatureId]: TaxYearFeature<TaxYearFeatureDataById[K]> } = {
  'cgt-rate-change-2024': cgtRateChange2024Feature,
}

/**
 * Get all features that apply to a specific tax year.
 *
 * @param taxYear - Tax year in format "YYYY/YY" (e.g., "2024/25")
 */
export function getApplicableFeatures(taxYear: string): TaxYearFeature[] {
  return Object.values(TAX_YEAR_FEATURES).filter((feature) => feature.applies(taxYear))
}

/**
 * Calculate all applicable features for a tax year summary.
 *
 * @param summary - The tax year summary
 * @param disposals - All disposal records for this tax year
 * @returns Map of feature ID to calculated feature data
 */
export function calculateTaxYearFeatures(
  summary: TaxYearSummary,
  disposals: DisposalRecord[]
): TaxYearFeaturesMap {
  const features: Partial<Record<TaxYearFeatureId, TaxYearFeatureData>> = {}

  for (const feature of getApplicableFeatures(summary.taxYear)) {
    const data = feature.calculate(summary, disposals)
    if (data !== null) {
      features[feature.id] = data
    }
  }

  // Each feature's calculate() returns its own data type, keyed by its ID
  return features as TaxYearFeaturesMap
}
