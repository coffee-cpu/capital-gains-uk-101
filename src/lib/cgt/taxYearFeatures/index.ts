/**
 * Tax Year Features Module
 *
 * Provides an extensible architecture for tax year-specific features.
 * Features are implemented as self-contained modules that can be registered
 * and applied when relevant, keeping the core TaxYearSummary type clean.
 */

// Core types
export type {
  TaxYearFeature,
  TaxYearFeatureData,
  TaxYearFeaturesMap,
  PDFRenderContext,
  FeaturePDFRenderer,
} from './types'

// Registry functions
export {
  getApplicableFeatures,
  getFeatureById,
  calculateTaxYearFeatures,
  hasApplicableFeatures,
  getAllFeatureIds,
} from './registry'

// Individual features and their data types
export {
  cgtRateChange2024Feature,
  CGT_RATE_CHANGE_DATE,
  AEA_2024_25,
  CGT_RATES,
} from './cgtRateChange2024'
export type { CGTRateChange2024Data } from './cgtRateChange2024'

// PDF rendering
export { renderAllFeaturePDFSections } from './pdfRenderers'
