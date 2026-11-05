import type { TaxYearSummary, DisposalRecord, Section104Pool } from '../../types/cgt'
import type { EnrichedTransaction } from '../../types/transaction'
import { renderAllFeaturePDFSections } from '../cgt/taxYearFeatures/pdfRenderers'
import { formatGbp } from '../../utils/currency'
import {
  getEffectivePrice,
  getEffectiveQuantity,
  getUnitLabel,
  isFullyUnmatched,
  QUANTITY_EPSILON,
} from '../cgt/utils'
import {
  dividendLines,
  findReportDataIssues,
  fxSourcesUsed,
  hasMissingFx,
  poolBalancesAt,
  sa108Rows,
} from './reportData'

/**
 * CGT report PDF document, shared by the web app's "Export PDF" button and the
 * CLI's `--format pdf`, so both produce the same report.
 *
 * The @react-pdf/renderer module is passed in rather than imported, so the web
 * app can keep lazy-loading it while the CLI bundles it.
 */
type PdfLibrary = typeof import('@react-pdf/renderer')
type PdfStyles = ReturnType<typeof createStyles>

export type ReactPdfLibrary = Pick<PdfLibrary, 'Document' | 'Page' | 'Text' | 'View' | 'StyleSheet'>

// Create styles factory (will be called after loading the library)
function createStyles(StyleSheet: PdfLibrary['StyleSheet']) {
  return StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 70,
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
  note: {
    fontSize: 7,
    color: '#6b7280',
    marginTop: 4,
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
  pageNumber: {
    position: 'absolute',
    bottom: 11,
    right: 40,
    fontSize: 8,
    color: '#ffffff',
    textAlign: 'right',
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
  warningBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#991b1b',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 8,
    color: '#991b1b',
    marginBottom: 3,
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

export interface PDFDocumentProps {
  taxYearSummary: TaxYearSummary
  disposals: DisposalRecord[]
  transactions: EnrichedTransaction[]
  includeTransactions?: boolean
  /** Section 104 pools from the CGT result, for the year-end holdings table */
  section104Pools?: Map<string, Section104Pool>
}

/**
 * Format an ISO date (YYYY-MM-DD) as DD/MM/YYYY. Date parses it as UTC midnight,
 * so it is formatted in UTC too; local time would print a day early west of UTC.
 */
export function formatReportDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', { timeZone: 'UTC' })
}

/**
 * Format a share/unit quantity: thousands separators, up to 8 decimal places
 * (crypto), no trailing zeros. 0.0086629 stays 0.0086629 rather than 0.01.
 */
export function formatQuantity(value: number): string {
  return value.toLocaleString('en-GB', { maximumFractionDigits: 8 })
}

/** A quantity with its unit, singular for exactly one: "1 contract", "1,200 shares" */
function quantityWithUnit(value: number, tx: { underlying_symbol?: string | null }): string {
  const formatted = formatQuantity(value)
  return `${formatted} ${getUnitLabel(tx, formatted !== '1')}`
}

/** Cards with more matching lines than this may split across pages rather than overflow one */
const MAX_UNBROKEN_CARD_LINES = 40

/** OPTIONS_BUY_TO_OPEN → "Options buy to open", TAX_ON_DIVIDEND → "Tax on dividend" */
export function formatTransactionType(type: string): string {
  const words = type.toLowerCase().replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const REPORT_DISCLAIMER =
  'This report is an estimate produced by Capital Gains Tax Visualiser from the transactions you imported, ' +
  "using HMRC's same-day, 30-day and Section 104 matching rules. It is not tax advice and may be wrong or " +
  'incomplete: it only knows about the transactions you imported, and it does not apply losses brought ' +
  'forward from earlier years or any other reliefs. Check the figures against your broker statements and ' +
  'HMRC helpsheet HS284, or ask a qualified adviser, before filing.'

function createCGTReportDocument(
  Document: PdfLibrary['Document'],
  Page: PdfLibrary['Page'],
  Text: PdfLibrary['Text'],
  View: PdfLibrary['View'],
  styles: PdfStyles
) {
  return ({ taxYearSummary, disposals, transactions, includeTransactions, section104Pools }: PDFDocumentProps) => {
    const formatCurrency = formatGbp
    const formatDate = formatReportDate

    // Filter transactions up to and including the tax year end date
    const filteredTransactions = includeTransactions
      ? transactions
          .filter(tx => tx.date <= taxYearSummary.endDate && !tx.ignored)
          .sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol))
      : []

    const issues = findReportDataIssues(taxYearSummary, disposals, transactions)
    const hasIssues = issues.missingFx.length > 0 || issues.incompleteDisposals.length > 0
    const fxSources = fxSourcesUsed(taxYearSummary, disposals, transactions)
    const sa108 = sa108Rows(taxYearSummary.taxYear, disposals)
    const dividends = dividendLines(taxYearSummary, transactions)
    const hasInterest = taxYearSummary.totalInterest > 0
    const poolBalances = poolBalancesAt(section104Pools, taxYearSummary.endDate)

    return (
      <Document>
        <Page size="A4" style={styles.page}>
          {/* Title */}
          <Text style={styles.title}>Capital Gains Tax Report</Text>
          <Text style={{ fontSize: 12, marginBottom: 4, color: '#6b7280' }}>
            Tax Year {taxYearSummary.taxYear} ({formatDate(taxYearSummary.startDate)} to {formatDate(taxYearSummary.endDate)})
          </Text>
          <Text style={{ fontSize: 8, marginBottom: 20, color: '#6b7280' }}>
            {fxSources.length > 0
              ? `Exchange rates: ${fxSources.join(', ')}`
              : 'Exchange rates: none needed (all amounts are in GBP)'}
          </Text>

          {/* Data problems that make the figures below wrong or incomplete */}
          {hasIssues && (
            <View style={styles.warningBox} wrap={false}>
              <Text style={styles.warningTitle}>Check before filing: this report is incomplete</Text>
              {issues.missingFx.map(({ currency, count }) => (
                <Text key={currency} style={styles.warningText}>
                  {`• No GBP exchange rate for ${count} ${currency} transaction(s) up to ${formatDate(taxYearSummary.endDate)}. ` +
                    'Their GBP values are counted as £0, so the gains or income that depend on them are wrong. ' +
                    'Add the missing rates and generate the report again.'}
                </Text>
              ))}
              {issues.incompleteDisposals.length > 0 && (
                <Text style={styles.warningText}>
                  {`• ${issues.incompleteDisposals.length} disposal(s) sold more than the imported history shows was acquired (` +
                    issues.incompleteDisposals
                      .map(d => `${d.disposal.symbol} on ${formatDate(d.disposal.date)}: ${quantityWithUnit(d.unmatchedQuantity ?? 0, d.disposal)} unmatched`)
                      .join('; ') +
                    '). Only the matched part of each is included: the proceeds, costs and gain of the unmatched ' +
                    'quantity are left out of every total in this report. Import earlier history, or work out their ' +
                    'gain from your own purchase records.'}
                </Text>
              )}
            </View>
          )}

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
              <Text style={[styles.summaryValue, taxYearSummary.totalLossesGbp < 0 ? { color: '#dc2626' } : {}]}>
                {formatCurrency(taxYearSummary.totalLossesGbp)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Net Gain/Loss:</Text>
              <Text style={[styles.totalValue, { color: taxYearSummary.netGainOrLossGbp >= 0 ? '#059669' : '#dc2626' }]}>
                {formatCurrency(taxYearSummary.netGainOrLossGbp)}
              </Text>
            </View>
            <View style={[styles.summaryRow, { marginTop: 6 }]}>
              <Text style={styles.summaryLabel}>Annual Exempt Amount:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(taxYearSummary.annualExemptAmount)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Taxable Gain:</Text>
              <Text style={[styles.totalValue, taxYearSummary.taxableGainGbp > 0 ? { color: '#dc2626' } : {}]}>
                {formatCurrency(taxYearSummary.taxableGainGbp)}
              </Text>
            </View>
          </View>

          {/* SA108 figures, per section of the form */}
          {sa108.length > 0 && (
            <View wrap={false}>
              <Text style={styles.subtitle}>SA108 Capital Gains Summary</Text>
              <View style={styles.summaryBox}>
                {sa108.map(row => {
                  const box = (n: string | undefined) => (n ? ` (box ${n})` : '')
                  return (
                    <View key={row.category} style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>
                        {row.section ? `${row.label}: "${row.section}" section` : row.label}
                      </Text>
                      {([
                        ['Number of disposals', row.boxes?.number, String(row.numberOfDisposals)],
                        ['Disposal proceeds', row.boxes?.proceeds, formatCurrency(row.proceedsGbp)],
                        ['Allowable costs (including purchase price)', row.boxes?.costs, formatCurrency(row.costsGbp)],
                        ['Gains in the year, before losses', row.boxes?.gains, formatCurrency(row.gainsGbp)],
                        ['Losses in the year', row.boxes?.losses, formatCurrency(row.lossesGbp)],
                      ] as const).map(([label, n, value]) => (
                        <View key={label} style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>{label + box(n)}</Text>
                          <Text style={styles.summaryValue}>{value}</Text>
                        </View>
                      ))}
                    </View>
                  )
                })}
                <Text style={styles.note}>
                  {'Disposals of the same asset on the same day are one disposal (TCGA92/S105(1)(a)), so their gains ' +
                    'and losses are netted: the gains and losses here can be lower than in the summary above, with the ' +
                    'same net gain or loss. Losses are shown as positive amounts, as on the form.'}
                </Text>
              </View>
            </View>
          )}

          {/* Dividend and interest income */}
          {(dividends.length > 0 || hasInterest) && (
            <View>
              <Text style={styles.subtitle} minPresenceAhead={60}>Dividend and Interest Income</Text>
              <View style={[styles.summaryBox, { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' }]}>
                {dividends.length > 0 && (
                  <>
                    <View style={[styles.summaryRow, { borderBottomWidth: 1, borderBottomColor: '#fde68a', paddingBottom: 2 }]}>
                      <Text style={[styles.summaryLabel, { width: '50%', fontFamily: 'Helvetica-Bold' }]}>Dividends by holding</Text>
                      <Text style={[styles.summaryLabel, { width: '25%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>Gross</Text>
                      <Text style={[styles.summaryLabel, { width: '25%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>Tax withheld</Text>
                    </View>
                    {dividends.map(line => (
                      <View key={line.symbol} style={styles.summaryRow} wrap={false}>
                        <Text style={[styles.summaryLabel, { width: '50%' }]}>{line.symbol}</Text>
                        <Text style={[styles.summaryLabel, { width: '25%', textAlign: 'right' }]}>{formatCurrency(line.grossGbp)}</Text>
                        <Text style={[styles.summaryLabel, { width: '25%', textAlign: 'right' }]}>{formatCurrency(line.withheldGbp)}</Text>
                      </View>
                    ))}
                    <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#fde68a', paddingTop: 2 }]}>
                      <Text style={[styles.summaryValue, { width: '50%' }]}>Total dividends</Text>
                      <Text style={[styles.summaryValue, { width: '25%', textAlign: 'right' }]}>{formatCurrency(taxYearSummary.grossDividendsGbp)}</Text>
                      <Text style={[styles.summaryValue, { width: '25%', textAlign: 'right' }]}>{formatCurrency(taxYearSummary.totalWithholdingTaxGbp)}</Text>
                    </View>
                  </>
                )}
                {hasInterest && (
                  <View style={[styles.summaryRow, { marginTop: dividends.length > 0 ? 6 : 0 }]}>
                    <Text style={[styles.summaryValue, { width: '50%' }]}>Interest</Text>
                    <Text style={[styles.summaryValue, { width: '25%', textAlign: 'right' }]}>{formatCurrency(taxYearSummary.grossInterestGbp)}</Text>
                    <Text style={[styles.summaryValue, { width: '25%', textAlign: 'right' }]}>{formatCurrency(taxYearSummary.interestWithholdingTaxGbp)}</Text>
                  </View>
                )}
                <Text style={[styles.note, { color: '#92400e' }]}>
                  {'This report cannot tell UK income from foreign income. Dividends from UK companies and UK funds, and ' +
                    'UK interest, go on the main tax return (SA100). Dividends and interest from abroad, including from ' +
                    'Irish-domiciled funds, go on the Foreign pages (SA106), where you may be able to claim Foreign Tax ' +
                    'Credit Relief for tax withheld. Dividends and interest are income, not capital gains.'}
                </Text>
              </View>
            </View>
          )}

          {/* Tax Year Features - dynamically rendered based on registry */}
          {renderAllFeaturePDFSections(taxYearSummary.features, {
            Text,
            View,
            styles,
            formatCurrency,
          })}

          {/* Disposal Records */}
          {disposals.length > 0 && (
            <>
              <Text style={styles.subtitle}>Disposal Details</Text>
              {disposals.map((disposal) => {
                const isGain = disposal.gainOrLossGbp >= 0
                const tx = disposal.disposal
                const unitSingular = getUnitLabel(tx, false)
                const quantity = getEffectiveQuantity(tx)
                const rawQuantity = Math.abs(tx.quantity ?? 0)
                const isSplitAdjusted =
                  tx.split_adjusted_quantity != null && Math.abs(tx.split_adjusted_quantity - rawQuantity) > QUANTITY_EPSILON
                const unmatched = disposal.unmatchedQuantity ?? 0
                const fee = tx.fee_gbp ?? 0
                const salePrice = tx.underlying_symbol != null
                  ? `Sale price: ${formatCurrency(getEffectivePrice(tx))} per underlying share` +
                    (tx.contract_size ? ` (${formatQuantity(tx.contract_size)} shares per contract)` : '')
                  : `Sale price: ${formatCurrency(getEffectivePrice(tx))} per ${unitSingular}`
                const acquisitionLines = disposal.matchings.reduce((n, m) => n + 1 + m.acquisitions.length, 0)
                return (
                  <View key={disposal.id} style={styles.disposalCard} wrap={acquisitionLines > MAX_UNBROKEN_CARD_LINES}>
                    {/* Header: Symbol, Date, Quantity, Gain/Loss */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
                      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold' }}>{tx.symbol}</Text>
                        <Text style={{ fontSize: 9, color: '#6b7280' }}>{formatDate(tx.date)}</Text>
                        <Text style={{ fontSize: 9, color: '#6b7280' }}>
                          {quantityWithUnit(quantity, tx) +
                            (isSplitAdjusted ? ` (${formatQuantity(rawQuantity)} before split adjustment)` : '')}
                        </Text>
                      </View>
                      <View>
                        <Text style={{ fontSize: 7, color: '#6b7280', textAlign: 'right' }}>Gain/(Loss)</Text>
                        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: isGain ? '#059669' : '#dc2626', textAlign: 'right' }}>
                          {formatCurrency(disposal.gainOrLossGbp)}
                        </Text>
                      </View>
                    </View>

                    {hasMissingFx(disposal) && (
                      <View style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 3, padding: 6, marginBottom: 8 }}>
                        <Text style={{ fontSize: 7, color: '#991b1b' }}>
                          No GBP exchange rate for this sale or an acquisition matched against it. Those values are counted as £0, so this gain or loss is wrong.
                        </Text>
                      </View>
                    )}

                    {/* Proceeds and Costs */}
                    <View style={{ flexDirection: 'row', marginBottom: 8, gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 7, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 }}>Proceeds</Text>
                        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>
                          {formatCurrency(disposal.proceedsGbp)}
                        </Text>
                        <Text style={{ fontSize: 7, color: '#6b7280' }}>
                          {salePrice + (fee > 0 ? ` (fees: ${formatCurrency(fee)})` : '')}
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
                      {isFullyUnmatched(disposal) ? (
                        <View style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 3, padding: 6 }}>
                          <Text style={{ fontSize: 8, color: '#991b1b', fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>No Matching Acquisitions</Text>
                          <Text style={{ fontSize: 7, color: '#991b1b' }}>
                            {`${quantityWithUnit(unmatched, tx)} could not be matched to any acquisition records. ` +
                              'Their proceeds, costs and gain are not included in this report: work them out from your own purchase records.'}
                          </Text>
                        </View>
                      ) : (
                        <>
                          {disposal.matchings
                            .filter(matching => matching.quantityMatched > QUANTITY_EPSILON)
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
                                    {quantityWithUnit(matching.quantityMatched, tx)}
                                  </Text>
                                </View>
                                {matching.acquisitions
                                  .filter(acq => acq.quantityMatched > QUANTITY_EPSILON)
                                  .map((acq, acqIdx) => (
                                    <Text key={acqIdx} style={{ fontSize: 7, color: '#4b5563' }}>
                                      {matching.rule === 'SECTION_104'
                                        ? `Pool average cost: ${formatCurrency(acq.costBasisGbp / acq.quantityMatched)} per ${unitSingular} (total: ${formatCurrency(acq.costBasisGbp)})`
                                        : `${formatDate(acq.transaction.date)}: ${quantityWithUnit(acq.quantityMatched, tx)} at ${formatCurrency(acq.costBasisGbp / acq.quantityMatched)} (cost: ${formatCurrency(acq.costBasisGbp)})`}
                                    </Text>
                                  ))}
                              </View>
                            ))}
                          {disposal.isIncomplete && unmatched > 0 && (
                            <View style={{ backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fde047', borderRadius: 3, padding: 6 }}>
                              <Text style={{ fontSize: 7, color: '#854d0e' }}>
                                <Text style={{ fontFamily: 'Helvetica-Bold' }}>Partially matched: </Text>
                                {`${formatQuantity(unmatched)} of ${quantityWithUnit(quantity, tx)} could not be matched. ` +
                                  `The proceeds, costs and gain shown cover only the ${quantityWithUnit(quantity - unmatched, tx)} that were matched; ` +
                                  'the rest are not included in this report.'}
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

          {/* Section 104 holdings at the year end */}
          {poolBalances.length > 0 && (
            <View>
              <Text style={styles.subtitle} minPresenceAhead={60}>{`Section 104 Holdings at ${formatDate(taxYearSummary.endDate)}`}</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { width: '40%' }]}>Asset</Text>
                  <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Quantity</Text>
                  <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Pool cost</Text>
                  <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Average cost</Text>
                </View>
                {poolBalances.map(pool => (
                  <View key={pool.symbol} style={styles.tableRow} wrap={false}>
                    <Text style={[styles.tableCell, { width: '40%' }]}>{pool.symbol}</Text>
                    <Text style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>{formatQuantity(pool.quantity)}</Text>
                    <Text style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>{formatCurrency(pool.costGbp)}</Text>
                    <Text style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>{formatCurrency(pool.costGbp / pool.quantity)}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.note}>
                The cost carried forward for next year's disposals. Quantities are adjusted for any later stock splits.
              </Text>
            </View>
          )}

          {/* All Transactions (optional) */}
          {includeTransactions && filteredTransactions.length > 0 && (
            <>
              <Text style={styles.subtitle} break>All Transactions (to {formatDate(taxYearSummary.endDate)})</Text>
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { width: '11%' }]}>Date</Text>
                  <Text style={[styles.tableHeaderCell, { width: '23%' }]}>Type</Text>
                  <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Symbol</Text>
                  <Text style={[styles.tableHeaderCell, { width: '11%', textAlign: 'right' }]}>Qty</Text>
                  <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>Price</Text>
                  <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>Value</Text>
                  <Text style={[styles.tableHeaderCell, { width: '11%', textAlign: 'right' }]}>Fee</Text>
                </View>
                {/* Table Rows */}
                {filteredTransactions.map((tx) => (
                  <View key={tx.id} style={styles.tableRow} wrap={false}>
                    <Text style={[styles.tableCell, { width: '11%' }]}>{formatDate(tx.date)}</Text>
                    <Text style={[styles.tableCell, { width: '23%' }]}>{formatTransactionType(tx.type)}</Text>
                    <Text style={[styles.tableCell, { width: '20%' }]}>{tx.symbol}</Text>
                    <Text style={[styles.tableCell, { width: '11%', textAlign: 'right' }]}>
                      {tx.quantity?.toFixed(2) ?? '-'}
                    </Text>
                    <Text style={[styles.tableCell, { width: '12%', textAlign: 'right' }]}>
                      {tx.price_gbp != null ? formatCurrency(tx.price_gbp) : '-'}
                    </Text>
                    <Text style={[styles.tableCell, { width: '12%', textAlign: 'right' }]}>
                      {tx.value_gbp != null ? formatCurrency(tx.value_gbp) : '-'}
                    </Text>
                    <Text style={[styles.tableCell, { width: '11%', textAlign: 'right' }]}>
                      {tx.fee_gbp != null ? formatCurrency(tx.fee_gbp) : '-'}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Disclaimer */}
          <View style={styles.disclaimer} wrap={false}>
            <Text>{REPORT_DISCLAIMER}</Text>
          </View>

          {/* Footer */}
          <View style={styles.footer} fixed>
            <View>
              <Text style={[styles.footerText, styles.footerBold]}>Capital Gains Tax Visualiser • cgtvisualiser.co.uk</Text>
              <Text style={styles.footerText}>Free, open source, privacy focused tool</Text>
            </View>
            <View>
              <Text style={[styles.footerText, { textAlign: 'right' }]}>
                {`Generated ${new Date().toLocaleDateString('en-GB')}`}
              </Text>
              {/* Space for the page number, drawn separately below */}
              <Text style={styles.footerText}> </Text>
            </View>
          </View>
          {/* Page number, on top of the footer. Its style must not set a unitless
              lineHeight: react-pdf re-applies it on every page for fixed
              render-prop text, so it compounds until rendering fails. */}
          <Text
            fixed
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </Page>
      </Document>
    )
  }
}

/** Build the report document for one tax year */
export function buildCGTReportDocument(
  { Document, Page, Text, View, StyleSheet }: ReactPdfLibrary,
  props: PDFDocumentProps
) {
  const styles = createStyles(StyleSheet)
  const CGTReportDocument = createCGTReportDocument(Document, Page, Text, View, styles)
  return <CGTReportDocument {...props} />
}

/** File name used for a tax year's report, e.g. CGT-Report-2024-25.pdf */
export function pdfReportFileName(taxYear: string): string {
  return `CGT-Report-${taxYear.replace('/', '-')}.pdf`
}
