/**
 * PDF Renderer Registry for Tax Year Features
 *
 * Maps feature IDs to their PDF rendering functions, so the PDF export
 * renders feature-specific sections without hardcoding each feature.
 * The table's type requires a renderer for every TaxYearFeatureId.
 */

import type { PDFRenderContext, FeaturePDFRenderer, TaxYearFeatureDataById, TaxYearFeatureId, TaxYearFeaturesMap } from '../types'
import { renderCGTRateChange2024PDF } from './cgtRateChange2024PDF'

const PDF_RENDERERS: { [K in TaxYearFeatureId]: FeaturePDFRenderer<TaxYearFeatureDataById[K]> } = {
  'cgt-rate-change-2024': renderCGTRateChange2024PDF,
}

/**
 * Render the PDF section of every feature with data, in a stable order.
 *
 * @param features - Map of feature ID to feature data
 * @param context - PDF rendering context with components and styles
 */
export function renderAllFeaturePDFSections(
  features: TaxYearFeaturesMap | undefined,
  context: PDFRenderContext
): React.ReactElement[] {
  if (!features) return []

  return (Object.keys(PDF_RENDERERS) as TaxYearFeatureId[]).flatMap(id => {
    const data = features[id]
    const element = data ? PDF_RENDERERS[id](data, context) : null
    return element ? [element] : []
  })
}
