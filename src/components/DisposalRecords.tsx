import { useTransactionStore } from '../stores/transactionStore'
import { useState } from 'react'

const EMPTY_DISPOSALS: never[] = []

interface DisposalRecordsProps {
  /** Custom container className - defaults to card with shadow */
  containerClassName?: string
  /** Whether to show header with title - defaults to true */
  showHeader?: boolean
  /** Custom header title - defaults to "Disposal Records" */
  headerTitle?: string
}

export function DisposalRecords({
  containerClassName = "bg-white shadow rounded-lg overflow-hidden",
  showHeader = true,
  headerTitle = "Disposal Records"
}: DisposalRecordsProps = {}) {
  const allDisposals = useTransactionStore((state) => state.cgtResults?.disposals ?? EMPTY_DISPOSALS)
  const selectedTaxYear = useTransactionStore((state) => state.selectedTaxYear)
  const [expandedDisposal, setExpandedDisposal] = useState<string | null>(null)

  if (allDisposals.length === 0) {
    return null
  }

  // Filter disposals by selected tax year
  const disposals = allDisposals.filter(d => d.taxYear === selectedTaxYear)

  // If no disposals in selected tax year, show empty state
  if (disposals.length === 0) {
    return (
      <div className={containerClassName}>
        {showHeader && (
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-900">{headerTitle}</h2>
            <p className="text-sm text-gray-500 mt-1">
              No disposals in {selectedTaxYear}
              {allDisposals.length > 0 && (
                <span className="text-gray-400"> ({allDisposals.length} in other tax years)</span>
              )}
            </p>
          </div>
        )}
        <div className="px-6 py-8 text-center text-gray-500">
          <p>No share disposals recorded for the {selectedTaxYear} tax year.</p>
          <p className="text-sm mt-2">Select a different tax year above to view its disposals.</p>
        </div>
      </div>
    )
  }

  // Calculate totals
  const totalGains = disposals
    .filter(d => d.gainOrLossGbp > 0)
    .reduce((sum, d) => sum + d.gainOrLossGbp, 0)

  const totalLosses = disposals
    .filter(d => d.gainOrLossGbp < 0)
    .reduce((sum, d) => sum + d.gainOrLossGbp, 0)

  return (
    <div className={containerClassName}>
      {showHeader && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">{headerTitle}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {disposals.length} disposal{disposals.length !== 1 ? 's' : ''} in {selectedTaxYear}
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 grid grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-gray-500 uppercase">Total Gains</div>
          <div className="text-lg font-semibold text-green-600">
            £{totalGains.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Total Losses</div>
          <div className="text-lg font-semibold text-red-600">
            £{Math.abs(totalLosses).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Disposals</div>
          <div className="text-lg font-semibold text-gray-900">{disposals.length}</div>
        </div>
      </div>

      {/* Disposal List */}
      <div className="divide-y divide-gray-200">
        {disposals.map((disposal) => {
          const isExpanded = expandedDisposal === disposal.id
          const isGain = disposal.gainOrLossGbp > 0

          return (
            <div key={disposal.id} className="px-6 py-4 hover:bg-gray-50">
              <button
                onClick={() => setExpandedDisposal(isExpanded ? null : disposal.id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">
                        {disposal.disposal.symbol}
                      </span>
                      <span className="text-sm text-gray-500">
                        {disposal.disposal.date}
                      </span>
                      <span className="text-sm text-gray-600">
                        {disposal.disposal.quantity?.toFixed(2)} shares
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Tax Year: {disposal.taxYear}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Gain/(Loss)</div>
                      <div className={`text-lg font-semibold ${isGain ? 'text-green-600' : 'text-red-600'}`}>
                        £{Math.abs(disposal.gainOrLossGbp).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-200">
                  {/* Proceeds */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-gray-500 uppercase mb-1">Proceeds</div>
                      <div className="font-medium">
                        £{disposal.proceedsGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Sale price: £{disposal.disposal.price_gbp?.toFixed(2)} per share
                        {disposal.disposal.fee_gbp && disposal.disposal.fee_gbp > 0 && (
                          <span> (fees: £{disposal.disposal.fee_gbp.toFixed(2)})</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase mb-1">Allowable Costs</div>
                      <div className="font-medium">
                        £{disposal.allowableCostsGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Matchings */}
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-2">Matched Acquisitions</div>
                    <div className="space-y-2">
                      {disposal.matchings.map((matching, idx) => (
                        <div key={idx} className="bg-gray-50 rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${
                              matching.rule === 'SAME_DAY' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                              matching.rule === '30_DAY' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                              'bg-green-100 text-green-800 border-green-300'
                            }`}>
                              {matching.rule === 'SAME_DAY' ? 'Same Day' :
                               matching.rule === '30_DAY' ? '30-Day Rule' :
                               'Section 104 Pool'}
                            </span>
                            <span className="text-sm font-medium">
                              {matching.quantityMatched.toFixed(2)} shares
                            </span>
                          </div>
                          {matching.acquisitions.map((acq, acqIdx) => (
                            <div key={acqIdx} className="text-xs text-gray-600">
                              {matching.rule !== 'SECTION_104' && (
                                <>
                                  {acq.transaction.date}: {acq.quantityMatched.toFixed(2)} shares at £{(acq.costBasisGbp / acq.quantityMatched).toFixed(2)}
                                  {' '}(cost: £{acq.costBasisGbp.toFixed(2)})
                                </>
                              )}
                              {matching.rule === 'SECTION_104' && (
                                <>
                                  Pool average cost: £{(acq.costBasisGbp / acq.quantityMatched).toFixed(2)} per share
                                  {' '}(total: £{acq.costBasisGbp.toFixed(2)})
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Calculation Summary */}
                  <div className="bg-blue-50 rounded p-3 text-sm">
                    <div className="font-medium text-blue-900 mb-2">Calculation</div>
                    <div className="space-y-1 text-blue-800">
                      <div className="flex justify-between">
                        <span>Proceeds:</span>
                        <span>£{disposal.proceedsGbp.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Less: Allowable costs:</span>
                        <span>(£{disposal.allowableCostsGbp.toFixed(2)})</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-blue-200 pt-1 mt-1">
                        <span>Gain/(Loss):</span>
                        <span className={isGain ? 'text-green-700' : 'text-red-700'}>
                          £{disposal.gainOrLossGbp.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
