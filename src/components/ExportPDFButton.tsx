import { useState, useRef, useEffect, useMemo } from 'react'
import { useTransactionStore, selectTransactions } from '../stores/transactionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { generatePDFReport } from './PDFExport'
import {
  formatReportDate,
  transactionHistoryRows,
  type TransactionHistoryScope,
} from '../lib/pdf/cgtReportDocument'

function plural(count: number, noun: string): string {
  return `${count.toLocaleString('en-GB')} ${noun}${count === 1 ? '' : 's'}`
}

export function ExportPDFButton() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const transactionHistory = useSettingsStore((state) => state.pdfTransactionHistory)
  const setTransactionHistory = useSettingsStore((state) => state.setPdfTransactionHistory)

  // Close the menu when clicking outside it or pressing Escape
  useEffect(() => {
    if (!isDropdownOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDropdownOpen])

  const selectedTaxYear = useTransactionStore((state) => state.selectedTaxYear)
  const cgtResults = useTransactionStore((state) => state.cgtResults)
  const getTaxYearSummary = useTransactionStore((state) => state.getTaxYearSummary)
  const getDisposals = useTransactionStore((state) => state.getDisposals)
  const transactions = useTransactionStore(selectTransactions)
  const setHasExportedPDF = useTransactionStore((state) => state.setHasExportedPDF)

  const handleExport = async () => {
    setIsDropdownOpen(false)
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
        transactionHistory,
        cgtResults?.section104Pools
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

  // How many rows each appendix option would add, for the menu
  const historyCounts = useMemo(() => {
    if (!taxYearSummary) return null
    const all = transactionHistoryRows(transactions, taxYearSummary, 'all')
    return {
      taxYear: transactionHistoryRows(transactions, taxYearSummary, 'tax-year').length,
      all: all.length,
      firstDate: all[0]?.date,
    }
  }, [transactions, taxYearSummary])

  const historyOptions: { value: TransactionHistoryScope; label: string; description: string }[] = [
    {
      value: 'none',
      label: 'None',
      description: 'Summary, disposals and holdings only',
    },
    {
      value: 'tax-year',
      label: `Tax year ${selectedTaxYear} only`,
      description: taxYearSummary && historyCounts
        ? `${plural(historyCounts.taxYear, 'transaction')}, ${formatReportDate(taxYearSummary.startDate)} to ${formatReportDate(taxYearSummary.endDate)}`
        : '',
    },
    {
      value: 'all',
      label: 'All history',
      description: taxYearSummary && historyCounts
        ? `${plural(historyCounts.all, 'transaction')}` +
          (historyCounts.firstDate ? `, ${formatReportDate(historyCounts.firstDate)} to ${formatReportDate(taxYearSummary.endDate)}` : '') +
          ', including earlier years whose purchases make up the cost basis'
        : '',
    },
  ]

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
              : transactionHistory === 'tax-year'
              ? `Export PDF report with this tax year's transactions`
              : transactionHistory === 'all'
              ? 'Export PDF report with all transactions up to the year end'
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
              {transactionHistory === 'none' ? 'Export PDF' : 'Export PDF + history'}
            </>
          )}
        </button>

        {/* Dropdown toggle button */}
        <button
          ref={toggleRef}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={isDisabled}
          className={`inline-flex items-center px-2 py-1.5 text-xs font-medium rounded-r-md border-l border-blue-700 text-white ${
            isDisabled
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          }`}
          aria-label="PDF export options"
          aria-haspopup="dialog"
          aria-expanded={isDropdownOpen}
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

      {/* Options panel - opens upward */}
      {isDropdownOpen && (
        <div
          role="dialog"
          aria-label="PDF export options"
          className="absolute right-0 bottom-full mb-1 w-80 max-w-[calc(100vw-2rem)] rounded-md shadow-lg bg-white border border-gray-200 z-50"
        >
          <fieldset className="px-3 pt-3 pb-2">
            <legend className="float-left w-full text-sm font-medium text-gray-900">Transaction history appendix</legend>
            <p className="clear-left pt-0.5 text-xs text-gray-500">
              A table at the end of the report listing the transactions behind the figures, for your
              records or your accountant.
            </p>
            <div className="mt-2 space-y-1">
              {historyOptions.map(option => (
                <label
                  key={option.value}
                  className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="pdf-transaction-history"
                    value={option.value}
                    checked={transactionHistory === option.value}
                    onChange={() => void setTransactionHistory(option.value)}
                    className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span>
                    <span className="block text-sm text-gray-800">{option.label}</span>
                    <span className="block text-xs text-gray-500">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="border-t border-gray-100 px-3 py-2 flex justify-end">
            <button
              onClick={handleExport}
              disabled={isDisabled}
              className="px-3 py-1.5 text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Export PDF
            </button>
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
