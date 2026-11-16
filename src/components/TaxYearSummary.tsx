import { AlertTriangle, CheckCircle2 } from 'lucide-react'
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

interface TaxYearAnswerProps {
  taxYear: string
  taxableGainGbp: number
  netGainOrLossGbp: number
  annualExemptAmount: number
}

/**
 * The headline answer for the selected tax year: the taxable gain, whether
 * CGT may be due, and the one-line reason. The worked figures follow in the
 * "CGT Calculation" box below.
 */
function TaxYearAnswer({ taxYear, taxableGainGbp, netGainOrLossGbp, annualExemptAmount }: TaxYearAnswerProps) {
  const isTaxable = taxableGainGbp > 0
  const exemptAmount = formatGbpWhole(annualExemptAmount)

  let reason: string
  if (isTaxable) {
    reason = `Net gain of ${formatGbpWhole(netGainOrLossGbp)}, less the ${exemptAmount} annual exempt amount.`
  } else if (netGainOrLossGbp < 0) {
    reason = `Net loss of ${formatGbpWhole(Math.abs(netGainOrLossGbp))}. You can carry a loss forward to later years if you report it to HMRC within 4 years.`
  } else {
    reason = `Net gain of ${formatGbpWhole(netGainOrLossGbp)} is within the ${exemptAmount} annual exempt amount.`
  }

  return (
    <div
      data-testid="tax-year-answer"
      className={`rounded-lg border p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
        isTaxable ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
      }`}
    >
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Taxable gain {taxYear}
        </div>
        <div className={`text-4xl font-bold tabular-nums mt-1 ${isTaxable ? 'text-amber-900' : 'text-emerald-900'}`}>
          {formatGbpWhole(taxableGainGbp)}
        </div>
        <p className={`text-sm mt-1 ${isTaxable ? 'text-amber-800' : 'text-emerald-800'}`}>{reason}</p>
      </div>
      <div
        className={`sm:ml-auto shrink-0 self-start sm:self-center inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
          isTaxable ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
        }`}
      >
        {isTaxable ? (
          <AlertTriangle className="w-4 h-4" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
        )}
        {isTaxable ? 'CGT may be due' : 'No CGT due'}
      </div>
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700"></div>
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
                className="block pl-3 pr-9 py-1 text-base font-semibold text-brand-700 bg-brand-50 border-2 border-brand-200 rounded-md hover:border-brand-400 hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 appearance-none cursor-pointer transition-colors"
              >
                {cgtResults.taxYearSummaries.map((summary) => (
                  <option key={summary.taxYear} value={summary.taxYear}>
                    {summary.taxYear}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-brand-700">
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

        <TaxYearAnswer
          taxYear={currentSummary.taxYear}
          taxableGainGbp={currentSummary.taxableGainGbp}
          netGainOrLossGbp={currentSummary.netGainOrLossGbp}
          annualExemptAmount={currentSummary.annualExemptAmount}
        />

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
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">CGT Calculation</h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Total Gains</span>
              <span className="font-medium text-gray-900">
                {formatGbp(currentSummary.totalGainsGbp)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-700">Total Losses</span>
              <span className="font-medium text-gray-900">
                {formatGbp(currentSummary.totalLossesGbp)}
              </span>
            </div>

            <div className="border-t border-gray-200 pt-2">
              <div className="flex justify-between items-center font-semibold">
                <span className="text-gray-700">Net Gain/(Loss)</span>
                <span className={currentSummary.netGainOrLossGbp >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {formatGbp(currentSummary.netGainOrLossGbp)}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-700">
                Less: Annual Exempt Amount
                <Tooltip content="View HMRC official rates and allowances">
                  <a
                    href="https://www.gov.uk/government/publications/rates-and-allowances-capital-gains-tax/capital-gains-tax-rates-and-annual-tax-free-allowances"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-brand-700 hover:text-brand-900 underline text-xs"
                  >
                    (source)
                  </a>
                </Tooltip>
              </span>
              <span className="font-medium text-gray-900">
                ({formatGbpWhole(currentSummary.annualExemptAmount)})
              </span>
            </div>

            <div className="border-t border-gray-300 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Taxable Gain</span>
                <span className={`text-2xl font-bold ${hasTaxableGain ? 'text-red-700' : 'text-green-700'}`}>
                  {formatGbp(currentSummary.taxableGainGbp)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tax Year-Specific Features (e.g., CGT Rate Change 2024) */}
        <TaxYearFeaturesRenderer summary={currentSummary} />

        {/* Pointer to the per-transaction detail */}
        <p className="text-sm text-gray-600">
          <a href="#transactions" className="font-medium text-brand-700 hover:text-brand-900 underline">
            See every transaction
          </a>
          {' '}with the FX rate used and the HMRC matching rule applied (Same Day, 30-Day, Section 104).
        </p>

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
                    className="bg-gray-50 hover:bg-gray-100 rounded-lg p-3 text-left transition-colors border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 uppercase mb-0.5">Dividend Income</div>
                        <div className="text-xl font-bold text-gray-900 flex items-center gap-2">
                          {formatGbpWhole(currentSummary.grossDividendsGbp)}
                          <span className="text-xs font-normal text-gray-600">
                            ({currentSummary.totalDividends} {currentSummary.totalDividends === 1 ? 'payment' : 'payments'})
                          </span>
                        </div>
                      </div>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showDividends ? 'transform rotate-180' : ''}`}
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
                    className="bg-gray-50 hover:bg-gray-100 rounded-lg p-3 text-left transition-colors border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 uppercase mb-0.5">Interest Income</div>
                        <div className="text-xl font-bold text-gray-900 flex items-center gap-2">
                          {formatGbpWhole(currentSummary.grossInterestGbp)}
                          <span className="text-xs font-normal text-gray-600">
                            ({currentSummary.totalInterest} {currentSummary.totalInterest === 1 ? 'payment' : 'payments'})
                          </span>
                        </div>
                      </div>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showInterest ? 'transform rotate-180' : ''}`}
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
