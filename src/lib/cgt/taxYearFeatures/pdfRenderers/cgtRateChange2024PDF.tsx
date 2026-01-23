/**
 * PDF Renderer for CGT Rate Change 2024 Feature
 *
 * Renders the 2024/25 CGT rate change section in PDF exports.
 * This module encapsulates all 2024-specific PDF rendering logic,
 * keeping the main PDFExport component clean and extensible.
 */

import type { CGTRateChange2024Data } from '../cgtRateChange2024'
import type { FeaturePDFRenderer, PDFRenderContext } from '../types'

/**
 * Render the CGT Rate Change 2024 section for PDF export.
 *
 * Shows different content based on whether Box 51 adjustment is required:
 * - Required: Detailed breakdown of gains/losses before and after 30 Oct 2024
 * - Not required: Brief explanation of why no adjustment is needed
 */
export const renderCGTRateChange2024PDF: FeaturePDFRenderer<CGTRateChange2024Data> = (
  data,
  context
) => {
  const { Text, View, styles } = context

  return (
    <>
      <Text style={styles.subtitle}>2024 CGT Rate Change — 30 October 2024</Text>
      <View
        style={[
          styles.summaryBox,
          {
            backgroundColor: data.requiresAdjustment ? '#fffbeb' : '#eff6ff',
            borderWidth: 1,
            borderColor: data.requiresAdjustment ? '#fde68a' : '#bfdbfe',
          },
        ]}
      >
        {data.requiresAdjustment ? (
          <AdjustmentRequiredContent data={data} context={context} />
        ) : (
          <NoAdjustmentRequiredContent data={data} context={context} />
        )}
      </View>
    </>
  )
}

interface ContentProps {
  data: CGTRateChange2024Data
  context: PDFRenderContext
}

/**
 * Content for when Box 51 adjustment is required
 */
function AdjustmentRequiredContent({ data, context }: ContentProps): React.ReactElement {
  const { Text, View, styles, formatCurrency } = context

  return (
    <>
      <Text style={{ fontSize: 8, color: '#92400e', marginBottom: 8, fontStyle: 'italic' }}>
        Box 51 Adjustment Required: Use these figures in HMRC's CGT adjustment calculator.
      </Text>

      {/* Before 30 Oct section */}
      {(data.gainsBeforeRateChange > 0 || data.lossesBeforeRateChange < 0) && (
        <>
          <Text
            style={{
              fontSize: 9,
              fontFamily: 'Helvetica-Bold',
              color: '#92400e',
              marginBottom: 4,
            }}
          >
            Before 30 Oct 2024 ({data.oldRates.basic}%/{data.oldRates.higher}% rates)
          </Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Gains:</Text>
            <Text style={[styles.summaryValue, { color: '#059669' }]}>
              {formatCurrency(data.gainsBeforeRateChange)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Losses:</Text>
            <Text style={[styles.summaryValue, { color: '#dc2626' }]}>
              ({formatCurrency(Math.abs(data.lossesBeforeRateChange))})
            </Text>
          </View>
          <View style={[styles.summaryRow, { marginBottom: 8 }]}>
            <Text style={styles.summaryLabel}>Net:</Text>
            <Text
              style={[
                styles.summaryValue,
                { color: data.netGainOrLossBeforeRateChange >= 0 ? '#059669' : '#dc2626' },
              ]}
            >
              {formatCurrency(data.netGainOrLossBeforeRateChange)}
            </Text>
          </View>
        </>
      )}

      {/* From 30 Oct section */}
      <Text
        style={{
          fontSize: 9,
          fontFamily: 'Helvetica-Bold',
          color: '#92400e',
          marginBottom: 4,
          marginTop: data.gainsBeforeRateChange > 0 ? 4 : 0,
          paddingTop: data.gainsBeforeRateChange > 0 ? 4 : 0,
          borderTopWidth: data.gainsBeforeRateChange > 0 ? 1 : 0,
          borderTopColor: '#fde68a',
        }}
      >
        From 30 Oct 2024 ({data.newRates.basic}%/{data.newRates.higher}% rates)
      </Text>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Gains:</Text>
        <Text style={[styles.summaryValue, { color: '#059669' }]}>
          {formatCurrency(data.gainsAfterRateChange)}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Losses:</Text>
        <Text style={[styles.summaryValue, { color: '#dc2626' }]}>
          ({formatCurrency(Math.abs(data.lossesAfterRateChange))})
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Net:</Text>
        <Text
          style={[
            styles.summaryValue,
            { color: data.netGainOrLossAfterRateChange >= 0 ? '#059669' : '#dc2626' },
          ]}
        >
          {formatCurrency(data.netGainOrLossAfterRateChange)}
        </Text>
      </View>

      <Text style={{ fontSize: 7, color: '#92400e', marginTop: 8 }}>
        Use HMRC's calculator: gov.uk/guidance/work-out-your-capital-gains-tax-adjustment-for-the-2024-to-2025-tax-year
      </Text>
    </>
  )
}

/**
 * Content for when no Box 51 adjustment is required
 */
function NoAdjustmentRequiredContent({ data, context }: ContentProps): React.ReactElement {
  const { Text, formatCurrency } = context

  const message =
    data.totalNetGainOrLoss <= data.annualExemptAmount
      ? `Net gain (${formatCurrency(data.totalNetGainOrLoss)}) is below Annual Exempt Amount (${formatCurrency(data.annualExemptAmount)}). No CGT adjustment needed.`
      : `All disposals were before 30 October 2024. No CGT adjustment needed.`

  return <Text style={{ fontSize: 8, color: '#1e40af' }}>{message}</Text>
}
