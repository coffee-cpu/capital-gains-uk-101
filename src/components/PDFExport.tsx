import type { TaxYearSummary, DisposalRecord } from '../types/cgt'
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
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 40,
    backgroundColor: '#0f766e',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#ffffff',
    lineHeight: 1.4,
  },
  footerBold: {
    fontFamily: 'Helvetica-Bold',
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
  shortSellGroup: {
    backgroundColor: '#fce7f3',
    color: '#9d174d',
  },
  disposalCard: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
  },
  })
}

interface PDFDocumentProps {
  taxYearSummary: TaxYearSummary
  disposals: DisposalRecord[]
  transactions: EnrichedTransaction[]
  includeTransactions?: boolean
}

function createCGTReportDocument(Document: any, Page: any, Text: any, View: any, styles: any) {
  return ({ taxYearSummary, disposals, transactions, includeTransactions }: PDFDocumentProps) => {
    const formatCurrency = (value: number) => `£${value.toFixed(2)}`
    const formatDate = (date: string) => new Date(date).toLocaleDateString('en-GB')

    // Filter transactions up to and including the tax year end date
    const filteredTransactions = includeTransactions
      ? transactions
          .filter(tx => tx.date <= taxYearSummary.endDate && !tx.ignored)
          .sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol))
      : []

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

          {/* SA106 Foreign Dividend Summary */}
          {taxYearSummary.grossDividendsGbp > 0 && (
            <>
              <Text style={styles.subtitle}>SA106 Foreign Income Summary</Text>
              <View style={[styles.summaryBox, { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' }]}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Gross Dividends (before tax withheld):</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(taxYearSummary.grossDividendsGbp)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tax Withheld at Source:</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(taxYearSummary.totalWithholdingTaxGbp)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Net Dividends Received:</Text>
                  <Text style={styles.totalValue}>
                    {formatCurrency(taxYearSummary.grossDividendsGbp - taxYearSummary.totalWithholdingTaxGbp)}
                  </Text>
                </View>
                <Text style={{ fontSize: 7, color: '#92400e', marginTop: 8 }}>
                  Use these figures when completing SA106 (Foreign). You may be able to claim Foreign Tax Credit Relief for tax withheld.
                </Text>
              </View>
            </>
          )}

          {/* Disposal Records */}
          {disposals.length > 0 && (
            <>
              <Text style={styles.subtitle}>Disposal Details</Text>
              {disposals.map((disposal) => {
                const isGain = disposal.gainOrLossGbp >= 0
                return (
                  <View key={disposal.id} style={styles.disposalCard}>
                    {/* Header: Symbol, Date, Quantity, Gain/Loss */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
                      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold' }}>{disposal.disposal.symbol}</Text>
                        <Text style={{ fontSize: 9, color: '#6b7280' }}>{formatDate(disposal.disposal.date)}</Text>
                        <Text style={{ fontSize: 9, color: '#6b7280' }}>
                          {disposal.disposal.quantity?.toFixed(2)} shares
                        </Text>
                      </View>
                      <View>
                        <Text style={{ fontSize: 7, color: '#6b7280', textAlign: 'right' }}>Gain/(Loss)</Text>
                        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: isGain ? '#059669' : '#dc2626', textAlign: 'right' }}>
                          {formatCurrency(disposal.gainOrLossGbp)}
                        </Text>
                      </View>
                    </View>

                    {/* Proceeds and Costs */}
                    <View style={{ flexDirection: 'row', marginBottom: 8, gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 7, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 }}>Proceeds</Text>
                        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>
                          {formatCurrency(disposal.proceedsGbp)}
                        </Text>
                        <Text style={{ fontSize: 7, color: '#6b7280' }}>
                          Sale price: {formatCurrency(disposal.disposal.price_gbp || 0)} per share
                          {disposal.disposal.fee_gbp && disposal.disposal.fee_gbp > 0 && (
                            ` (fees: ${formatCurrency(disposal.disposal.fee_gbp)})`
                          )}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 7, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 }}>Allowable Costs</Text>
                        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>
                          {formatCurrency(disposal.allowableCostsGbp)}
                        </Text>
                      </View>
                    </View>

                    {/* Matched Acquisitions */}
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 7, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>Matched Acquisitions</Text>
                      {disposal.isIncomplete && disposal.unmatchedQuantity === disposal.disposal.quantity ? (
                        // Fully unmatched
                        <View style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 3, padding: 6 }}>
                          <Text style={{ fontSize: 8, color: '#991b1b', fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>No Matching Acquisitions</Text>
                          <Text style={{ fontSize: 7, color: '#991b1b' }}>
                            {disposal.unmatchedQuantity?.toFixed(2)} shares could not be matched to any acquisition records.
                          </Text>
                        </View>
                      ) : (
                        <>
                          {disposal.matchings
                            .filter(matching => matching.quantityMatched > 0)
                            .map((matching, mIdx) => (
                              <View key={mIdx} style={{ backgroundColor: '#f9fafb', borderRadius: 3, padding: 6, marginBottom: 4 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                                <View style={[
                                    styles.gainGroup,
                                    matching.rule === 'SAME_DAY' ? styles.sameDayGroup :
                                    matching.rule === '30_DAY' ? styles.thirtyDayGroup :
                                    matching.rule === 'SHORT_SELL' ? styles.shortSellGroup :
                                    styles.section104Group
                                  ]}>
                                    <Text style={{ fontSize: 7 }}>
                                      {matching.rule === 'SAME_DAY' ? 'Same Day' :
                                       matching.rule === '30_DAY' ? '30-Day Rule' :
                                       matching.rule === 'SHORT_SELL' ? 'Short Sell' :
                                       'Section 104 Pool'}
                                    </Text>
                                  </View>
                                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>
                                    {matching.quantityMatched.toFixed(2)} shares
                                  </Text>
                                </View>
                                {matching.acquisitions.map((acq, acqIdx) => (
                                  <Text key={acqIdx} style={{ fontSize: 7, color: '#4b5563' }}>
                                    {matching.rule !== 'SECTION_104' && (
                                      `${formatDate(acq.transaction.date)}: ${acq.quantityMatched.toFixed(2)} shares at ${formatCurrency(acq.costBasisGbp / acq.quantityMatched)} (cost: ${formatCurrency(acq.costBasisGbp)})`
                                    )}
                                    {matching.rule === 'SECTION_104' && (
                                      `Pool average cost: ${formatCurrency(acq.costBasisGbp / acq.quantityMatched)} per share (total: ${formatCurrency(acq.costBasisGbp)})`
                                    )}
                                  </Text>
                                ))}
                              </View>
                            ))}
                          {disposal.isIncomplete && disposal.unmatchedQuantity && disposal.unmatchedQuantity > 0 && (
                            // Partially matched
                            <View style={{ backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fde047', borderRadius: 3, padding: 6 }}>
                              <Text style={{ fontSize: 7, color: '#854d0e' }}>
                                <Text style={{ fontFamily: 'Helvetica-Bold' }}>Partially matched:</Text> {disposal.unmatchedQuantity.toFixed(2)} shares could not be matched.
                              </Text>
                            </View>
                          )}
                        </>
                      )}
                    </View>

                    {/* Calculation Summary */}
                    <View style={{ backgroundColor: '#eff6ff', borderRadius: 3, padding: 6 }}>
                      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1e3a8a', marginBottom: 3 }}>Calculation</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 }}>
                        <Text style={{ fontSize: 7, color: '#1e40af' }}>Proceeds:</Text>
                        <Text style={{ fontSize: 7, color: '#1e40af' }}>{formatCurrency(disposal.proceedsGbp)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text style={{ fontSize: 7, color: '#1e40af' }}>Less: Allowable costs:</Text>
                        <Text style={{ fontSize: 7, color: '#1e40af' }}>({formatCurrency(disposal.allowableCostsGbp)})</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#bfdbfe', paddingTop: 2 }}>
                        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1e3a8a' }}>Gain/(Loss):</Text>
                        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: isGain ? '#065f46' : '#991b1b' }}>
                          {formatCurrency(disposal.gainOrLossGbp)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )
              })}
            </>
          )}

          {/* All Transactions (optional) */}
          {includeTransactions && filteredTransactions.length > 0 && (
            <>
              <Text style={styles.subtitle} break>All Transactions (to {formatDate(taxYearSummary.endDate)})</Text>
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Date</Text>
                  <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Type</Text>
                  <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Symbol</Text>
                  <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>Qty</Text>
                  <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>Price (£)</Text>
                  <Text style={[styles.tableHeaderCell, { width: '18%', textAlign: 'right' }]}>Value (£)</Text>
                  <Text style={[styles.tableHeaderCell, { width: '18%', textAlign: 'right' }]}>Fee (£)</Text>
                </View>
                {/* Table Rows */}
                {filteredTransactions.map((tx) => (
                  <View key={tx.id} style={styles.tableRow} wrap={false}>
                    <Text style={[styles.tableCell, { width: '12%' }]}>{formatDate(tx.date)}</Text>
                    <Text style={[styles.tableCell, { width: '10%' }]}>{tx.type}</Text>
                    <Text style={[styles.tableCell, { width: '15%' }]}>{tx.symbol}</Text>
                    <Text style={[styles.tableCell, { width: '12%', textAlign: 'right' }]}>
                      {tx.quantity?.toFixed(2) ?? '-'}
                    </Text>
                    <Text style={[styles.tableCell, { width: '15%', textAlign: 'right' }]}>
                      {tx.price_gbp?.toFixed(2) ?? '-'}
                    </Text>
                    <Text style={[styles.tableCell, { width: '18%', textAlign: 'right' }]}>
                      {tx.value_gbp?.toFixed(2) ?? '-'}
                    </Text>
                    <Text style={[styles.tableCell, { width: '18%', textAlign: 'right' }]}>
                      {tx.fee_gbp?.toFixed(2) ?? '-'}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <View>
              <Text style={[styles.footerText, styles.footerBold]}>Capital Gains Tax Visualiser • cgtvisualiser.co.uk</Text>
              <Text style={styles.footerText}>Free, open source, privacy focused tool</Text>
            </View>
            <View>
              <Text style={[styles.footerText, { textAlign: 'right' }]}>Generated:</Text>
              <Text style={[styles.footerText, { textAlign: 'right' }]}>
                {new Date().toLocaleDateString('en-GB')}
              </Text>
            </View>
          </View>
        </Page>
      </Document>
    )
  }
}

/**
 * Generate and download a PDF report for the given tax year.
 * This function lazy-loads @react-pdf/renderer only when called.
 * @param includeTransactions - If true, includes a full list of all transactions up to the tax year end
 */
export async function generatePDFReport(
  taxYearSummary: TaxYearSummary,
  disposals: DisposalRecord[],
  transactions: EnrichedTransaction[],
  includeTransactions: boolean = false
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
    includeTransactions={includeTransactions}
  />

  const blob = await pdf(doc).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `CGT-Report-${taxYearSummary.taxYear.replace('/', '-')}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}
