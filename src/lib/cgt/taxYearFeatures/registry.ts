/**
 * Tax Year Features Registry
 *
 * Central registry for all tax year-specific features.
 * Features can be registered here and will be automatically applied
 * to relevant tax years during CGT calculation.
 *
 * To add a new feature:
 * 1. Create the feature module in this directory
 * 2. Import and add it to the TAX_YEAR_FEATURES array below
 */

import type { TaxYearSummary, DisposalRecord } from '../../../types/cgt'
import type { TaxYearFeature, TaxYearFeaturesMap } from './types'
import { cgtRateChange2024Feature } from './cgtRateChange2024'

/**
 * All registered tax year features.
 * Add new features to this array as they are implemented.
 */
const TAX_YEAR_FEATURES: TaxYearFeature[] = [
  cgtRateChange2024Feature,
  // Future features can be added here, e.g.:
  // cgtRateChange2028Feature,
  // newReportingRequirement2026Feature,
]

/**
 * Get all features that apply to a specific tax year.
 *
 * @param taxYear - Tax year in format "YYYY/YY" (e.g., "2024/25")
 * @returns Array of applicable features
 */
export function getApplicableFeatures(taxYear: string): TaxYearFeature[] {
  return TAX_YEAR_FEATURES.filter((feature) => feature.applies(taxYear))
}

/**
 * Get a specific feature by ID.
 *
 * @param featureId - The unique feature identifier
 * @returns The feature, or undefined if not found
 */
export function getFeatureById(featureId: string): TaxYearFeature | undefined {
  return TAX_YEAR_FEATURES.find((feature) => feature.id === featureId)
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
  const features: TaxYearFeaturesMap = {}

  for (const feature of getApplicableFeatures(summary.taxYear)) {
    const data = feature.calculate(summary, disposals)
    if (data !== null) {
      features[feature.id] = data
    }
  }

  return features
}

/**
 * Check if a tax year has any applicable features.
 *
 * @param taxYear - Tax year in format "YYYY/YY" (e.g., "2024/25")
 * @returns True if at least one feature applies
 */
export function hasApplicableFeatures(taxYear: string): boolean {
  return TAX_YEAR_FEATURES.some((feature) => feature.applies(taxYear))
}

/**
 * Get all registered feature IDs.
 *
 * @returns Array of all feature IDs
 */
export function getAllFeatureIds(): string[] {
  return TAX_YEAR_FEATURES.map((feature) => feature.id)
}

// Re-export types for convenience
export type { TaxYearFeature, TaxYearFeatureData, TaxYearFeaturesMap } from './types'

// Re-export specific feature data types
export type { CGTRateChange2024Data } from './cgtRateChange2024'
