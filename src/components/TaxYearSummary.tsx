import { useTransactionStore } from '../stores/transactionStore'
import { useHelpPanelStore } from '../stores/helpPanelStore'
import { useState } from 'react'
import { DisposalRecords } from './DisposalRecords'
import { Tooltip } from './Tooltip'
import { DividendDetailsPanel, InterestDetailsPanel } from './IncomeDetailsPanels'
import { IssuePointer } from './IssuePointer'
import { ExportPDFButton } from './ExportPDFButton'
import { BuyMeACoffee } from './BuyMeACoffee'
import { TaxYearFeaturesRenderer } from './taxYearFeatures'
import { formatGbp, formatGbpWhole } from '../utils/currency'

/**
 * Shown instead of the summary when only acquisitions were imported. What to
 * import next is in the Issues panel ("No Disposals Found").
 */
function BuyOnlyNote() {
  return (
    <div className="bg-white shadow rounded-lg p-6" data-testid="buy-only-note">
      <p className="text-sm text-gray-700">
        <span className="font-medium text-gray-900">No capital gains to calculate yet.</span>{' '}
        Your imported transactions include purchases but no sales. See the Issues panel above for what to import.
      </p>
    </div>
  )
}

export function TaxYearSummary() {
  const cgtResults = useTransactionStore((state) => state.cgtResults)
  const isLoading = useTransactionStore((state) => state.isLoading)
  const selectedTaxYear = useTransactionStore((state) => state.selectedTaxYear)
  const setSelectedTaxYear = useTransactionStore((state) => state.setSelectedTaxYear)
  const hasExportedPDF = useTransactionStore((state) => state.hasExportedPDF)
  const toggleHelpPanelWithContext = useHelpPanelStore((state) => state.toggleWithContext)
  const [showDisposals, setShowDisposals] = useState(false)
  const [showDividends, setShowDividends] = useState(false)
  const [showInterest, setShowInterest] = useState(false)

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-4 font-medium">Calculating tax summary from your data...</p>
            <p className="text-gray-500 text-sm mt-2">Processing disposals and applying HMRC rules</p>
          </div>
        </div>
      </div>
    )
  }

  if (!cgtResults) {
    return null
  }

  if (cgtResults.taxYearSummaries.length === 0) {
    return null
  }

  const currentSummary = cgtResults.taxYearSummaries.find(s => s.taxYear === selectedTaxYear)
    || cgtResults.taxYearSummaries[0]

  if (!currentSummary) {
    return null
  }

  // Check if we have BUY transactions but no SELL transactions (no disposals at all)
  const metadata = cgtResults.metadata
  const hasBuysOnly = metadata && metadata.totalBuys > 0 && metadata.totalSells === 0

  if (hasBuysOnly) {
    return <BuyOnlyNote />
  }

  const hasTaxableGain = currentSummary.taxableGainGbp > 0

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="space-y-2">
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-semibold text-gray-900">Tax Year Summary</h2>

            {/* Tax Year Selector Dropdown */}
            <div className="relative">
              <select
                id="tax-year-select"
                value={selectedTaxYear}
                onChange={(e) => setSelectedTaxYear(e.target.value)}
                className="block pl-3 pr-9 py-1 text-base font-semibold text-blue-600 bg-blue-50 border-2 border-blue-200 rounded-md hover:border-blue-400 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer transition-colors"
              >
                {cgtResults.taxYearSummaries.map((summary) => (
                  <option key={summary.taxYear} value={summary.taxYear}>
                    {summary.taxYear}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-blue-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500">Capital gains tax calculation</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Period Info */}
        <div className="text-sm text-gray-600">
          Period: {currentSummary.startDate} to {currentSummary.endDate}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setShowDisposals(!showDisposals)}
            className="bg-gray-50 hover:bg-gray-100 rounded-lg p-4 text-left transition-colors"
          >
            <div className="text-xs text-gray-500 uppercase mb-1">Disposals</div>
            <div className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              {currentSummary.totalDisposals}
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${showDisposals ? 'transform rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {currentSummary.disposals.length !== currentSummary.totalDisposals && (
              <div className="text-xs text-gray-500 mt-1">
                {currentSummary.disposals.length} sales; same-day sales of a share count as one
              </div>
            )}
          </button>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase mb-1">Total Proceeds</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatGbpWhole(currentSummary.totalProceedsGbp)}
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-xs text-green-600 uppercase mb-1">Gains</div>
            <div className="text-2xl font-bold text-green-700">
              {formatGbpWhole(currentSummary.totalGainsGbp)}
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-xs text-red-600 uppercase mb-1">Losses</div>
            <div className="text-2xl font-bold text-red-700">
              {formatGbpWhole(Math.abs(currentSummary.totalLossesGbp))}
            </div>
          </div>
        </div>

        {/* Warning for disposals valued with a missing exchange rate */}
        {(currentSummary.missingFxDisposals ?? 0) > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" data-testid="missing-fx-warning">
            <h4 className="text-sm font-medium text-red-800">Missing Exchange Rates</h4>
            <p className="mt-1 text-sm text-red-700">
              {currentSummary.missingFxDisposals} disposal{currentSummary.missingFxDisposals !== 1 ? 's' : ''} use a transaction with no GBP exchange rate, valued at £0.
              The gains and losses above are wrong until the rate is available. Try reloading, or choose a different FX source.
            </p>
          </div>
        )}

        {currentSummary.incompleteDisposals > 0 && (
          <IssuePointer testId="incomplete-disposals-pointer">
            {currentSummary.incompleteDisposals} disposal{currentSummary.incompleteDisposals !== 1 ? 's' : ''} this tax year could
            not be fully matched, so the figures above cover only the matched shares. See "Incomplete Disposal Data" in the Issues panel above.
          </IssuePointer>
        )}

        {/* Disposal Records Panel */}
        {showDisposals && (
          <DisposalRecords
            containerClassName="bg-white border border-gray-200 rounded-lg overflow-hidden"
            showHeader={true}
            headerTitle="Disposal Records"
          />
        )}

        {/* CGT Calculation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">CGT Calculation</h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-blue-800">Total Gains</span>
              <span className="font-medium text-blue-900">
                {formatGbp(currentSummary.totalGainsGbp)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-blue-800">Total Losses</span>
              <span className="font-medium text-blue-900">
                {formatGbp(currentSummary.totalLossesGbp)}
              </span>
            </div>

            <div className="border-t border-blue-300 pt-2">
              <div className="flex justify-between items-center font-semibold">
                <span className="text-blue-800">Net Gain/(Loss)</span>
                <span className={currentSummary.netGainOrLossGbp >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {formatGbp(currentSummary.netGainOrLossGbp)}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-blue-800">
                Less: Annual Exempt Amount
                <Tooltip content="View HMRC official rates and allowances">
                  <a
                    href="https://www.gov.uk/government/publications/rates-and-allowances-capital-gains-tax/capital-gains-tax-rates-and-annual-tax-free-allowances"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-blue-600 hover:text-blue-800 underline text-xs"
                  >
                    (source)
                  </a>
                </Tooltip>
              </span>
              <span className="font-medium text-blue-900">
                ({formatGbpWhole(currentSummary.annualExemptAmount)})
              </span>
            </div>

            <div className="border-t border-blue-400 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-blue-900">Taxable Gain</span>
                <span className={`text-2xl font-bold ${hasTaxableGain ? 'text-red-700' : 'text-green-700'}`}>
                  {formatGbp(currentSummary.taxableGainGbp)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tax Year-Specific Features (e.g., CGT Rate Change 2024) */}
        <TaxYearFeaturesRenderer summary={currentSummary} />

        {/* Tax Status Message */}
        {hasTaxableGain ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-yellow-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-yellow-800">Capital Gains Tax May Be Due</h4>
                <p className="mt-1 text-sm text-yellow-700">
                  Your taxable gain exceeds the annual exempt amount. You may need to report this and pay CGT.
                  Consult a tax professional for advice.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-green-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-green-800">Within Annual Exemption</h4>
                <p className="mt-1 text-sm text-green-700">
                  Your gains are within the annual exempt amount. No CGT is due for this tax year.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Hint to view transaction details */}
        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <svg className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">Want more details?</span>
            {' '}Scroll down to the <span className="font-medium">Transactions</span> table to see FX rates used for each transaction,
            which HMRC matching rules were applied (Same Day, 30-Day, Section 104), and how gains were calculated.
          </div>
        </div>

        {/* Other Income Section */}
        {(currentSummary.totalDividends > 0 || currentSummary.totalInterest > 0) && (
          <>
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Other Income (for reference)</h3>
              <p className="text-xs text-gray-500 mb-3">
                Dividends and interest are taxed separately from capital gains and do not affect your CGT calculation above.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Dividend Income Card */}
                {currentSummary.totalDividends > 0 && (
                  <button
                    onClick={() => {
                      setShowDividends(!showDividends)
                      if (!showDividends) setShowInterest(false)
                    }}
                    className="bg-purple-50 hover:bg-purple-100 rounded-lg p-3 text-left transition-colors border border-purple-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-xs text-purple-600 uppercase mb-0.5">Dividend Income</div>
                        <div className="text-xl font-bold text-purple-900 flex items-center gap-2">
                          {formatGbpWhole(currentSummary.grossDividendsGbp)}
                          <span className="text-xs font-normal text-purple-700">
                            ({currentSummary.totalDividends} {currentSummary.totalDividends === 1 ? 'payment' : 'payments'})
                          </span>
                        </div>
                      </div>
                      <svg
                        className={`w-4 h-4 text-purple-400 transition-transform flex-shrink-0 ${showDividends ? 'transform rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                )}

                {/* Interest Income Card */}
                {currentSummary.totalInterest > 0 && (
                  <button
                    onClick={() => {
                      setShowInterest(!showInterest)
                      if (!showInterest) setShowDividends(false)
                    }}
                    className="bg-purple-50 hover:bg-purple-100 rounded-lg p-3 text-left transition-colors border border-purple-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-xs text-purple-600 uppercase mb-0.5">Interest Income</div>
                        <div className="text-xl font-bold text-purple-900 flex items-center gap-2">
                          {formatGbpWhole(currentSummary.grossInterestGbp)}
                          <span className="text-xs font-normal text-purple-700">
                            ({currentSummary.totalInterest} {currentSummary.totalInterest === 1 ? 'payment' : 'payments'})
                          </span>
                        </div>
                      </div>
                      <svg
                        className={`w-4 h-4 text-purple-400 transition-transform flex-shrink-0 ${showInterest ? 'transform rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {showDividends && currentSummary.totalDividends > 0 && (
              <DividendDetailsPanel summary={currentSummary} onHelp={() => toggleHelpPanelWithContext('dividend')} />
            )}

            {showInterest && currentSummary.totalInterest > 0 && (
              <InterestDetailsPanel summary={currentSummary} onHelp={() => toggleHelpPanelWithContext('interest')} />
            )}
          </>
        )}

        {/* Disclaimer and Export Button */}
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-gray-500 italic">
            This is an estimate based on HMRC guidance. Always consult a qualified tax professional for your specific situation.
          </div>
          <div className="flex-shrink-0">
            <ExportPDFButton />
          </div>
        </div>

        {/* Buy Me A Coffee - Only shown after PDF export */}
        {hasExportedPDF && <BuyMeACoffee />}
      </div>
    </div>
  )
}
