import { useTransactionStore } from '../stores/transactionStore'
import { useState } from 'react'
import { DisposalRecords } from './DisposalRecords'
import { Tooltip } from './Tooltip'
import { ExportPDFButton } from './ExportPDFButton'
import { BuyMeACoffee } from './BuyMeACoffee'

export function TaxYearSummary() {
  const cgtResults = useTransactionStore((state) => state.cgtResults)
  const selectedTaxYear = useTransactionStore((state) => state.selectedTaxYear)
  const setSelectedTaxYear = useTransactionStore((state) => state.setSelectedTaxYear)
  const hasExportedPDF = useTransactionStore((state) => state.hasExportedPDF)
  const setHelpPanelOpen = useTransactionStore((state) => state.setHelpPanelOpen)
  const setHelpContext = useTransactionStore((state) => state.setHelpContext)
  const [showDisposals, setShowDisposals] = useState(false)
  const [showDividends, setShowDividends] = useState(false)
  const [showInterest, setShowInterest] = useState(false)

  if (!cgtResults || cgtResults.taxYearSummaries.length === 0) {
    return null
  }

  const currentSummary = cgtResults.taxYearSummaries.find(s => s.taxYear === selectedTaxYear)
    || cgtResults.taxYearSummaries[0]

  if (!currentSummary) {
    return null
  }

  const hasTaxableGain = currentSummary.taxableGainGbp > 0
  const dividendsExceedAllowance = currentSummary.totalDividendsGbp > currentSummary.dividendAllowance

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
          </button>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase mb-1">Total Proceeds</div>
            <div className="text-2xl font-bold text-gray-900">
              £{currentSummary.totalProceedsGbp.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-xs text-green-600 uppercase mb-1">Gains</div>
            <div className="text-2xl font-bold text-green-700">
              £{currentSummary.totalGainsGbp.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-xs text-red-600 uppercase mb-1">Losses</div>
            <div className="text-2xl font-bold text-red-700">
              £{Math.abs(currentSummary.totalLossesGbp).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>


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
                £{currentSummary.totalGainsGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-blue-800">Total Losses</span>
              <span className="font-medium text-blue-900">
                (£{Math.abs(currentSummary.totalLossesGbp).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
              </span>
            </div>

            <div className="border-t border-blue-300 pt-2">
              <div className="flex justify-between items-center font-semibold">
                <span className="text-blue-800">Net Gain/(Loss)</span>
                <span className={currentSummary.netGainOrLossGbp >= 0 ? 'text-green-700' : 'text-red-700'}>
                  £{currentSummary.netGainOrLossGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                (£{currentSummary.annualExemptAmount.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
              </span>
            </div>

            <div className="border-t border-blue-400 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-blue-900">Taxable Gain</span>
                <span className={`text-2xl font-bold ${hasTaxableGain ? 'text-red-700' : 'text-green-700'}`}>
                  £{currentSummary.taxableGainGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

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

        {/* Other Income Section */}
        {(currentSummary.totalDividends > 0 || currentSummary.totalInterest > 0) && (
          <>
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Other Income (For Reference)</h3>
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
                          £{currentSummary.totalDividendsGbp.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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
                          £{currentSummary.totalInterestGbp.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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

            {/* Dividend Details Panel */}
            {showDividends && currentSummary.totalDividends > 0 && (
              <div className="bg-white border border-purple-200 rounded-lg overflow-hidden">
                <div className="bg-purple-50 px-6 py-4 border-b border-purple-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-purple-900">Dividend Income Details</h3>
                      <p className="text-sm text-purple-700 mt-1">
                        Dividend tax is calculated separately from capital gains tax.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setHelpContext('dividend')
                        setHelpPanelOpen(true)
                      }}
                      className="p-1 rounded hover:bg-purple-100 transition-colors flex-shrink-0"
                      aria-label="Learn about dividend tax"
                    >
                      <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-purple-800">Total Dividends Received</span>
                      <span className="font-medium text-purple-900">
                        £{currentSummary.totalDividendsGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-purple-800">
                        Less: Dividend Allowance
                        <Tooltip content="View HMRC tax on dividends information">
                          <a
                            href="https://www.gov.uk/tax-on-dividends"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-purple-600 hover:text-purple-800 underline text-xs"
                          >
                            (source)
                          </a>
                        </Tooltip>
                      </span>
                      <span className="font-medium text-purple-900">
                        (£{currentSummary.dividendAllowance.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                      </span>
                    </div>

                    <div className="border-t border-purple-300 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-purple-900">Taxable Dividends</span>
                        <span className={`text-2xl font-bold ${dividendsExceedAllowance ? 'text-red-700' : 'text-green-700'}`}>
                          £{Math.max(0, currentSummary.totalDividendsGbp - currentSummary.dividendAllowance).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dividend Reporting Guidance */}
                  {dividendsExceedAllowance ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex">
                        <svg className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-yellow-800">Dividend Reporting Required</h4>
                          <p className="mt-1 text-sm text-yellow-700">
                            Your dividends exceed the £{currentSummary.dividendAllowance.toLocaleString('en-GB')} allowance.
                            {currentSummary.totalDividendsGbp > 10000
                              ? ' You must complete a Self Assessment tax return.'
                              : ' You must inform HMRC (via Self Assessment if dividends exceed £10,000).'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex">
                        <svg className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-green-800">Within Dividend Allowance</h4>
                          <p className="mt-1 text-sm text-green-700">
                            Your dividends are within the £{currentSummary.dividendAllowance.toLocaleString('en-GB')} allowance. No dividend tax is due.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Interest Details Panel */}
            {showInterest && currentSummary.totalInterest > 0 && (
              <div className="bg-white border border-purple-200 rounded-lg overflow-hidden">
                <div className="bg-purple-50 px-6 py-4 border-b border-purple-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-purple-900">Interest Income Details</h3>
                      <p className="text-sm text-purple-700 mt-1">
                        Interest tax is calculated separately from capital gains tax.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setHelpContext('interest')
                        setHelpPanelOpen(true)
                      }}
                      className="p-1 rounded hover:bg-purple-100 transition-colors flex-shrink-0"
                      aria-label="Learn about interest tax"
                    >
                      <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-purple-800">Total Interest Received</span>
                      <span className="font-medium text-purple-900">
                        £{currentSummary.totalInterestGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="py-2">
                      <p className="text-sm text-purple-800">
                        <strong>Personal Savings Allowance:</strong>
                        {' '}£1,000 (basic rate), £500 (higher rate), or £0 (additional rate)
                        <Tooltip content="View HMRC savings interest information">
                          <a
                            href="https://www.gov.uk/apply-tax-free-interest-on-savings"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-purple-600 hover:text-purple-800 underline text-xs"
                          >
                            (source)
                          </a>
                        </Tooltip>
                      </p>
                      <p className="text-sm text-purple-700 mt-1">
                        Interest above your allowance is taxed at your income tax rate (20%, 40%, or 45%).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
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
