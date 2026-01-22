/**
 * Tax Year Features Renderer
 *
 * Maps feature IDs to their UI components and renders all applicable
 * features for a given tax year summary.
 *
 * This component acts as a registry for feature UI components,
 * keeping the main TaxYearSummary component clean.
 */

import type { ReactElement } from 'react'
import type { TaxYearSummary } from '../../types/cgt'
import type { CGTRateChange2024Data } from '../../lib/cgt/taxYearFeatures'
import { CGTRateChange2024Panel } from './CGTRateChange2024Panel'

interface TaxYearFeaturesRendererProps {
  summary: TaxYearSummary
}

/**
 * Type guard to check if data is CGTRateChange2024Data
 */
function isCGTRateChange2024Data(data: unknown): data is CGTRateChange2024Data {
  return (
    typeof data === 'object' &&
    data !== null &&
    'featureId' in data &&
    (data as { featureId: string }).featureId === 'cgt-rate-change-2024'
  )
}

/**
 * Renders all applicable tax year features for a summary.
 *
 * Features are rendered in a consistent order and only if they
 * have data to display.
 */
export function TaxYearFeaturesRenderer({
  summary,
}: TaxYearFeaturesRendererProps) {
  if (!summary.features || Object.keys(summary.features).length === 0) {
    return null
  }

  const renderedFeatures: ReactElement[] = []

  // Render CGT Rate Change 2024 feature if present
  const rateChangeData = summary.features['cgt-rate-change-2024']
  if (rateChangeData && isCGTRateChange2024Data(rateChangeData)) {
    renderedFeatures.push(
      <CGTRateChange2024Panel
        key="cgt-rate-change-2024"
        data={rateChangeData}
      />
    )
  }

  // Future features can be added here following the same pattern:
  // const otherFeatureData = summary.features['other-feature-id']
  // if (otherFeatureData && isOtherFeatureData(otherFeatureData)) {
  //   renderedFeatures.push(<OtherFeaturePanel key="other-feature-id" data={otherFeatureData} />)
  // }

  if (renderedFeatures.length === 0) {
    return null
  }

  return <div className="space-y-4">{renderedFeatures}</div>
}
