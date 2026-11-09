/**
 * Tax Year Features Renderer
 *
 * Renders the UI panel of every tax year feature that has data for a
 * summary. The table's type requires a panel for every TaxYearFeatureId.
 */

import type { ComponentType } from 'react'
import type { TaxYearSummary } from '../../types/cgt'
import type { TaxYearFeatureDataById, TaxYearFeatureId } from '../../lib/cgt/taxYearFeatures'
import { CGTRateChange2024Panel } from './CGTRateChange2024Panel'

const FEATURE_PANELS: { [K in TaxYearFeatureId]: ComponentType<{ data: TaxYearFeatureDataById[K] }> } = {
  'cgt-rate-change-2024': CGTRateChange2024Panel,
}

interface TaxYearFeaturesRendererProps {
  summary: TaxYearSummary
}

/**
 * Renders all applicable tax year features for a summary, in a consistent
 * order and only if they have data to display.
 */
export function TaxYearFeaturesRenderer({ summary }: TaxYearFeaturesRendererProps) {
  const features = summary.features
  if (!features) return null

  const panels = (Object.keys(FEATURE_PANELS) as TaxYearFeatureId[]).flatMap(id => {
    const data = features[id]
    if (!data) return []
    const Panel = FEATURE_PANELS[id]
    return [<Panel key={id} data={data} />]
  })

  if (panels.length === 0) return null

  return <div className="space-y-4">{panels}</div>
}
