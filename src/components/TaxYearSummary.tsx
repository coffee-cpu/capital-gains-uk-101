import { useTransactionStore } from '../stores/transactionStore'
import { useState } from 'react'
import { DisposalRecords } from './DisposalRecords'

export function TaxYearSummary() {
  const cgtResults = useTransactionStore((state) => state.cgtResults)
  const selectedTaxYear = useTransactionStore((state) => state.selectedTaxYear)
  const setSelectedTaxYear = useTransactionStore((state) => state.setSelectedTaxYear)
  const [showDisposals, setShowDisposals] = useState(false)

  if (!cgtResults || cgtResults.taxYearSummaries.length === 0) {
    return null
  }

  const currentSummary = cgtResults.taxYearSummaries.find(s => s.taxYear === selectedTaxYear)
    || cgtResults.taxYearSummaries[0]

  if (!currentSummary) {
    return null
  }

  const hasTaxableGain = currentSummary.taxableGainGbp > 0

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Tax Year Summary</h2>
            <p className="text-sm text-gray-500 mt-1">Capital gains tax calculation</p>
          </div>

          {/* Tax Year Selector */}
          <div className="flex gap-2">
            {cgtResults.taxYearSummaries.map((summary) => (
              <button
                key={summary.taxYear}
                onClick={() => setSelectedTaxYear(summary.taxYear)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  summary.taxYear === selectedTaxYear
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {summary.taxYear}
              </button>
            ))}
          </div>
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
              <span className="text-blue-800">Less: Annual Exempt Amount</span>
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

        {/* Disclaimer */}
        <div className="text-xs text-gray-500 italic">
          This is an estimate based on HMRC guidance. Always consult a qualified tax professional for your specific situation.
        </div>
      </div>
    </div>
  )
}
