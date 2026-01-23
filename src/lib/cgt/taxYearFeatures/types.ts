/**
 * Tax Year Features System
 *
 * This module provides an extensible architecture for tax year-specific features.
 * Instead of polluting the core TaxYearSummary type with year-specific fields,
 * features are implemented as self-contained modules that can be registered
 * and applied when relevant.
 *
 * Example: The 2024/25 CGT rate change only applies to that specific tax year,
 * so it's implemented as a feature rather than modifying core data structures.
 */

import type { TaxYearSummary, DisposalRecord } from '../../../types/cgt'

/**
 * Base interface for tax year feature data.
 * Each feature extends this with its specific data shape.
 */
export interface TaxYearFeatureData {
  /** Unique feature identifier */
  featureId: string
}

/**
 * PDF rendering context passed to feature PDF renderers.
 * Contains react-pdf components and shared styles needed to render PDF sections.
 */
export interface PDFRenderContext {
  /** react-pdf Text component */
  Text: any
  /** react-pdf View component */
  View: any
  /** Shared styles for the PDF document */
  styles: any
  /** Currency formatter */
  formatCurrency: (value: number) => string
}

/**
 * Function type for rendering a feature's PDF section.
 * Returns null if the feature has nothing to render.
 */
export type FeaturePDFRenderer<TData extends TaxYearFeatureData> = (
  data: TData,
  context: PDFRenderContext
) => React.ReactElement | null

/**
 * A tax year feature that can calculate data and be rendered in UI/PDF.
 *
 * @template TData - The shape of data this feature produces
 */
export interface TaxYearFeature<TData extends TaxYearFeatureData = TaxYearFeatureData> {
  /** Unique identifier for this feature (e.g., 'cgt-rate-change-2024') */
  id: string

  /** Human-readable name for the feature */
  name: string

  /** Description of what this feature does */
  description: string

  /**
   * Determine if this feature applies to a given tax year.
   * @param taxYear - Tax year in format "YYYY/YY" (e.g., "2024/25")
   */
  applies: (taxYear: string) => boolean

  /**
   * Calculate feature-specific data from the tax year summary and disposals.
   * @param summary - The tax year summary
   * @param disposals - All disposal records for this tax year
   * @returns Feature-specific data, or null if the feature doesn't produce data
   */
  calculate: (summary: TaxYearSummary, disposals: DisposalRecord[]) => TData | null
}

/**
 * Container for all calculated feature data for a tax year.
 * Keyed by feature ID.
 */
export type TaxYearFeaturesMap = Record<string, TaxYearFeatureData>
