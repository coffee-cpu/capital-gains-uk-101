import type { TaxYearSummary, DisposalRecord, Section104Pool } from '../types/cgt'
import type { EnrichedTransaction } from '../types/transaction'

/**
 * Lazy-load @react-pdf/renderer to avoid including it in the main bundle.
 * This module is only loaded when the user clicks the Export PDF button.
 */
async function loadPdfLibrary() {
  const module = await import('@react-pdf/renderer')
  return module
}

// Create styles factory (will be called after loading the library)
function createStyles(StyleSheet: any) {
  return StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 20,
    marginBottom: 10,
    fontFamily: 'Helvetica-Bold',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
    fontFamily: 'Helvetica-Bold',
  },
  section: {
    marginBottom: 12,
  },
  table: {
    width: '100%',
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#374151',
    paddingVertical: 6,
    marginBottom: 4,
    backgroundColor: '#f3f4f6',
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  tableCell: {
    fontSize: 8,
  },
  summaryBox: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 4,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 10,
  },
  summaryValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#374151',
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  totalValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  disclaimer: {
    fontSize: 7,
    color: '#6b7280',
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'center',
  },
  gainGroup: {
    fontSize: 7,
    padding: 2,
    borderRadius: 2,
    marginRight: 4,
  },
  sameDayGroup: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  thirtyDayGroup: {
    backgroundColor: '#fed7aa',
    color: '#c2410c',
  },
  section104Group: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  })
}

interface PDFDocumentProps {
  taxYearSummary: TaxYearSummary
  disposals: DisposalRecord[]
  transactions: EnrichedTransaction[]
  section104Pools: Map<string, Section104Pool>
}

function createCGTReportDocument(Document: any, Page: any, Text: any, View: any, styles: any) {
  return ({ taxYearSummary, disposals, section104Pools }: PDFDocumentProps) => {
    const formatCurrency = (value: number) => `£${value.toFixed(2)}`
    const formatDate = (date: string) => new Date(date).toLocaleDateString('en-GB')

    return (
      <Document>
        <Page size="A4" style={styles.page}>
          {/* Title */}
          <Text style={styles.title}>Capital Gains Tax Report</Text>
          <Text style={{ fontSize: 12, marginBottom: 20, color: '#6b7280' }}>
            Tax Year {taxYearSummary.taxYear} ({formatDate(taxYearSummary.startDate)} to {formatDate(taxYearSummary.endDate)})
          </Text>

          {/* Tax Year Summary */}
          <Text style={styles.subtitle}>Tax Year Summary</Text>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Disposals:</Text>
              <Text style={styles.summaryValue}>{taxYearSummary.totalDisposals}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Proceeds:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(taxYearSummary.totalProceedsGbp)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Allowable Costs:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(taxYearSummary.totalAllowableCostsGbp)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Gains:</Text>
              <Text style={[styles.summaryValue, { color: '#059669' }]}>
                {formatCurrency(taxYearSummary.totalGainsGbp)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Losses:</Text>
              <Text style={[styles.summaryValue, { color: '#dc2626' }]}>
                {formatCurrency(taxYearSummary.totalLossesGbp)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Net Gain/Loss:</Text>
              <Text style={[styles.totalValue, { color: taxYearSummary.netGainOrLossGbp >= 0 ? '#059669' : '#dc2626' }]}>
                {formatCurrency(taxYearSummary.netGainOrLossGbp)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Annual Exempt Amount:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(taxYearSummary.annualExemptAmount)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Taxable Gain:</Text>
              <Text style={[styles.totalValue, { color: '#dc2626' }]}>
                {formatCurrency(taxYearSummary.taxableGainGbp)}
              </Text>
            </View>
          </View>

          {/* Disposal Records */}
          {disposals.length > 0 && (
            <>
              <Text style={styles.subtitle}>Disposal Details</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Date</Text>
                  <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Symbol</Text>
                  <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Quantity</Text>
                  <Text style={[styles.tableHeaderCell, { width: '18%' }]}>Proceeds</Text>
                  <Text style={[styles.tableHeaderCell, { width: '18%' }]}>Costs</Text>
                  <Text style={[styles.tableHeaderCell, { width: '18%' }]}>Gain/Loss</Text>
                  <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Rule</Text>
                </View>
                {disposals.slice(0, 15).map((disposal) => (
                  <View key={disposal.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { width: '12%' }]}>
                      {formatDate(disposal.disposal.date)}
                    </Text>
                    <Text style={[styles.tableCell, { width: '12%' }]}>{disposal.disposal.symbol}</Text>
                    <Text style={[styles.tableCell, { width: '10%' }]}>
                      {disposal.disposal.quantity?.toFixed(2) || '—'}
                    </Text>
                    <Text style={[styles.tableCell, { width: '18%' }]}>
                      {formatCurrency(disposal.proceedsGbp)}
                    </Text>
                    <Text style={[styles.tableCell, { width: '18%' }]}>
                      {formatCurrency(disposal.allowableCostsGbp)}
                    </Text>
                    <Text style={[styles.tableCell, { width: '18%', color: disposal.gainOrLossGbp >= 0 ? '#059669' : '#dc2626' }]}>
                      {formatCurrency(disposal.gainOrLossGbp)}
                    </Text>
                    <Text style={[styles.tableCell, { width: '12%' }]}>
                      {disposal.matchings[0]?.rule || '—'}
                    </Text>
                  </View>
                ))}
              </View>
              {disposals.length > 15 && (
                <Text style={{ fontSize: 8, color: '#6b7280', marginBottom: 12 }}>
                  Showing first 15 of {disposals.length} disposals. See full transaction list below.
                </Text>
              )}
            </>
          )}

          {/* Section 104 Pools */}
          {section104Pools.size > 0 && (
            <>
              <Text style={styles.subtitle}>Section 104 Pools</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Symbol</Text>
                  <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Quantity</Text>
                  <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Total Cost (GBP)</Text>
                  <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Avg Cost/Share</Text>
                </View>
                {Array.from(section104Pools.values()).map((pool) => (
                  <View key={pool.symbol} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { width: '25%' }]}>{pool.symbol}</Text>
                    <Text style={[styles.tableCell, { width: '25%' }]}>{pool.quantity.toFixed(4)}</Text>
                    <Text style={[styles.tableCell, { width: '25%' }]}>
                      {formatCurrency(pool.totalCostGbp)}
                    </Text>
                    <Text style={[styles.tableCell, { width: '25%' }]}>
                      {formatCurrency(pool.averageCostGbp)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Footer */}
          <Text style={styles.footer}>
            Generated by Capital Gains Tax Visualiser (cgtvisualiser.co.uk) on {new Date().toLocaleDateString('en-GB')} at {new Date().toLocaleTimeString('en-GB')}
          </Text>
        </Page>
      </Document>
    )
  }
}

/**
 * Generate and download a PDF report for the given tax year.
 * This function lazy-loads @react-pdf/renderer only when called.
 */
export async function generatePDFReport(
  taxYearSummary: TaxYearSummary,
  disposals: DisposalRecord[],
  transactions: EnrichedTransaction[],
  section104Pools: Map<string, Section104Pool>
): Promise<void> {
  // Lazy-load the PDF library
  const { Document, Page, Text, View, StyleSheet, pdf } = await loadPdfLibrary()

  // Create styles with the loaded StyleSheet
  const styles = createStyles(StyleSheet)

  // Create the document component with all dependencies
  const CGTReportDocument = createCGTReportDocument(Document, Page, Text, View, styles)

  const doc = <CGTReportDocument
    taxYearSummary={taxYearSummary}
    disposals={disposals}
    transactions={transactions}
    section104Pools={section104Pools}
  />

  const blob = await pdf(doc).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `CGT-Report-${taxYearSummary.taxYear.replace('/', '-')}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}
