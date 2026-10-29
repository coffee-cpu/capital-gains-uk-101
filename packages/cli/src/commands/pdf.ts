import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { buildCGTReportDocument } from '../../../../src/lib/pdf/cgtReportDocument'
import { CGTCalculationResult } from '../../../../src/types/cgt'
import { CliError } from '../meta'

/**
 * Render one tax year's PDF report with the same document the web app's
 * "Export PDF" button uses.
 */
export async function renderPdfReport(
  result: CGTCalculationResult | null,
  taxYear: string,
  includeTransactions: boolean
): Promise<Buffer> {
  const taxYearSummary = result?.taxYearSummaries.find(s => s.taxYear === taxYear)
  if (!result || !taxYearSummary) {
    const available = (result?.taxYearSummaries.map(s => s.taxYear) ?? []).sort()
    throw new CliError(
      `No disposals or income in tax year ${taxYear}, so there is no report to write.` +
        (available.length > 0 ? ` Tax years with data: ${available.join(', ')}.` : '')
    )
  }

  const doc = buildCGTReportDocument(
    { Document, Page, Text, View, StyleSheet },
    {
      taxYearSummary,
      disposals: result.disposals.filter(d => d.taxYear === taxYear),
      transactions: result.transactions,
      includeTransactions,
    }
  )
  return renderToBuffer(doc)
}
