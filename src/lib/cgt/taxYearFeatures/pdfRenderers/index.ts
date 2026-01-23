/**
 * PDF Renderer Registry for Tax Year Features
 *
 * Maps feature IDs to their PDF rendering functions.
 * This registry enables the PDF export to dynamically render
 * feature-specific sections without hardcoding each feature.
 *
 * To add a new feature's PDF renderer:
 * 1. Create the renderer module in this directory
 * 2. Import and add it to the PDF_RENDERERS map below
 */

import type { PDFRenderContext, FeaturePDFRenderer, TaxYearFeaturesMap } from '../types'
import { renderCGTRateChange2024PDF } from './cgtRateChange2024PDF'

/**
 * Registry mapping feature IDs to their PDF renderer functions.
 */
const PDF_RENDERERS: Record<string, FeaturePDFRenderer<any>> = {
  'cgt-rate-change-2024': renderCGTRateChange2024PDF,
  // Future features can be added here, e.g.:
  // 'cgt-rate-change-2028': renderCGTRateChange2028PDF,
}

/**
 * Render all feature PDF sections for a given features map.
 *
 * Iterates through all features and calls their PDF renderers,
 * returning an array of rendered elements.
 *
 * @param features - Map of feature ID to feature data
 * @param context - PDF rendering context with components and styles
 * @returns Array of rendered PDF elements
 */
export function renderAllFeaturePDFSections(
  features: TaxYearFeaturesMap | undefined,
  context: PDFRenderContext
): React.ReactElement[] {
  if (!features) return []

  const elements: React.ReactElement[] = []

  for (const [featureId, data] of Object.entries(features)) {
    const renderer = PDF_RENDERERS[featureId]
    if (renderer) {
      const element = renderer(data, context)
      if (element) {
        elements.push(element)
      }
    }
  }

  return elements
}
