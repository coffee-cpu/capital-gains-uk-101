import type { TaxYearSummary, DisposalRecord } from '../types/cgt'
import type { EnrichedTransaction } from '../types/transaction'
import { buildCGTReportDocument, pdfReportFileName } from '../lib/pdf/cgtReportDocument'

/**
 * Lazy-load @react-pdf/renderer to avoid including it in the main bundle.
 * This module is only loaded when the user clicks the Export PDF button.
 */
async function loadPdfLibrary() {
  const module = await import('@react-pdf/renderer')
  return module
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
  const library = await loadPdfLibrary()

  const doc = buildCGTReportDocument(library, {
    taxYearSummary,
    disposals,
    transactions,
    includeTransactions,
  })

  const blob = await library.pdf(doc).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = pdfReportFileName(taxYearSummary.taxYear)
  link.click()
  URL.revokeObjectURL(url)
}
