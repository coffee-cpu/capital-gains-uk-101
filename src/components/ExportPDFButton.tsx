import { useState } from 'react'
import { useTransactionStore } from '../stores/transactionStore'
import { generatePDFReport } from './PDFExport'

export function ExportPDFButton() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [includeTransactions, setIncludeTransactions] = useState(false)

  const selectedTaxYear = useTransactionStore((state) => state.selectedTaxYear)
  const cgtResults = useTransactionStore((state) => state.cgtResults)
  const getTaxYearSummary = useTransactionStore((state) => state.getTaxYearSummary)
  const getDisposals = useTransactionStore((state) => state.getDisposals)
  const transactions = useTransactionStore((state) => state.transactions)
  const setHasExportedPDF = useTransactionStore((state) => state.setHasExportedPDF)

  const handleExport = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      // Get tax year summary
      const taxYearSummary = getTaxYearSummary(selectedTaxYear)

      if (!taxYearSummary) {
        throw new Error(`No data available for tax year ${selectedTaxYear}. Please run CGT calculations first.`)
      }

      // Get disposals for the selected tax year
      const allDisposals = getDisposals()
      const disposalsForYear = allDisposals.filter(d => d.taxYear === selectedTaxYear)

      // Generate PDF
      await generatePDFReport(
        taxYearSummary,
        disposalsForYear,
        transactions,
        includeTransactions
      )

      // Mark that user has successfully exported a PDF
      setHasExportedPDF(true)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate PDF report')
    } finally {
      setIsGenerating(false)
    }
  }

  // Check if we have CGT results
  const hasCGTResults = cgtResults !== null && cgtResults.taxYearSummaries.length > 0
  const taxYearSummary = getTaxYearSummary(selectedTaxYear)
  const hasDataForYear = taxYearSummary !== undefined

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={handleExport}
          disabled={!hasCGTResults || !hasDataForYear || isGenerating}
          className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white ${
            !hasCGTResults || !hasDataForYear || isGenerating
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          }`}
          title={
            !hasCGTResults
              ? 'Run CGT calculations first'
              : !hasDataForYear
              ? `No data for tax year ${selectedTaxYear}`
              : 'Export PDF report'
          }
        >
        {isGenerating ? (
          <>
            <svg
              className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Generating...
          </>
        ) : (
          <>
            <svg
              className="-ml-0.5 mr-1.5 h-3 w-3"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export PDF
          </>
        )}
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={includeTransactions}
          onChange={(e) => setIncludeTransactions(e.target.checked)}
          className="h-3 w-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          disabled={!hasCGTResults || !hasDataForYear}
        />
        Include all transactions
      </label>

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {!hasCGTResults && (
        <p className="mt-2 text-xs text-gray-500">
          Import transactions and run CGT calculations to enable PDF export
        </p>
      )}
    </div>
  )
}
