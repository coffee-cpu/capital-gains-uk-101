import { useState, useRef, useEffect } from 'react'
import { useTransactionStore } from '../stores/transactionStore'
import { generatePDFReport } from './PDFExport'

export function ExportPDFButton() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [includeTransactions, setIncludeTransactions] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

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

  const isDisabled = !hasCGTResults || !hasDataForYear || isGenerating

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="inline-flex rounded-md shadow-sm">
        {/* Main export button */}
        <button
          onClick={handleExport}
          disabled={isDisabled}
          className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-l-md text-white ${
            isDisabled
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

        {/* Dropdown toggle button */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={isDisabled}
          className={`inline-flex items-center px-2 py-1.5 text-xs font-medium rounded-r-md border-l border-blue-700 text-white ${
            isDisabled
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          }`}
          aria-label="Export options"
        >
          <svg
            className="h-3 w-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {/* Dropdown menu - opens upward */}
      {isDropdownOpen && (
        <div className="absolute right-0 bottom-full mb-1 w-52 rounded-md shadow-lg bg-white border border-gray-200 z-50">
          <div className="py-1">
            <label className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTransactions}
                onChange={(e) => setIncludeTransactions(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
              />
              Include all transactions
            </label>
          </div>
        </div>
      )}

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
