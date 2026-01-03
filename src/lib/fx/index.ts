/**
 * FX Module
 *
 * Provides multiple FX conversion strategies for capital gains calculations.
 *
 * HMRC Guidance (CG78310):
 * "HMRC does not prescribe what reference point should be used for the exchange rate.
 * It is, however, expected that a reasonable and consistent method is used."
 *
 * @see https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg78310
 */

// Re-export types
export * from '../../types/fxStrategy'

// Re-export manager
export { FXManager, getDefaultFXManager, resetDefaultFXManager, convertToGBP } from './manager'

// Re-export providers for direct access if needed
export { HMRCMonthlyProvider } from './providers/hmrcMonthly'
export { HMRCYearlyProvider } from './providers/hmrcYearly'
export { DailySpotProvider } from './providers/dailySpot'
export { BaseFXProvider } from './providers/base'
