import { useState } from 'react'
import { useTransactionStore } from '../stores/transactionStore'
import { ClearDataButton } from './ClearDataButton'
import { Tooltip } from './Tooltip'

export function TransactionList() {
  const transactions = useTransactionStore((state) => state.transactions)
  const [showFxInfo, setShowFxInfo] = useState(false)

  // Sort transactions by date (oldest first)
  const sortedTransactions = [...transactions].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  // Check for incomplete Stock Plan Activity transactions
  const incompleteTransactions = transactions.filter(tx => tx.incomplete)
  const incompleteSymbols = [...new Set(incompleteTransactions.map(tx => tx.symbol))].filter(Boolean)

  // Check for FX rate errors
  const fxErrorTransactions = transactions.filter(tx => tx.fx_error)
  const fxErrorCount = fxErrorTransactions.length

  if (transactions.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-500 text-center">No transactions imported yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Transactions</h2>
            <p className="text-sm text-gray-500 mt-1">{transactions.length} total</p>
          </div>
          <ClearDataButton />
        </div>
      </div>

      {/* Warning for FX rate errors */}
      {fxErrorCount > 0 && (
        <div className="px-6 py-4 bg-red-50 border-b border-red-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">FX Rate Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  Failed to fetch exchange rates for {fxErrorCount} transaction{fxErrorCount !== 1 ? 's' : ''}. GBP values cannot be calculated.
                </p>
                <p className="mt-1">
                  <strong>Possible causes:</strong> Network error, API unavailable, or invalid date/currency. Check the browser console for details.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning for incomplete Stock Plan Activity */}
      {incompleteSymbols.length > 0 && (
        <div className="px-6 py-4 bg-yellow-50 border-b border-yellow-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Incomplete Stock Plan Activity Detected</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  {incompleteTransactions.length} Stock Plan Activity transaction{incompleteTransactions.length !== 1 ? 's' : ''} for {incompleteSymbols.join(', ')} {incompleteSymbols.length !== 1 ? 'are' : 'is'} missing price data.
                </p>
                <p className="mt-1">
                  <strong>Action required:</strong> Please upload your Charles Schwab Equity Awards transaction history to get complete pricing information.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FX Rate Information */}
      {transactions.some(tx => tx.fx_source === 'HMRC') && (
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
          <div className="flex items-start justify-between">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <div className="text-sm text-blue-700">
                  <p>
                    Foreign currency values have been converted to GBP using{' '}
                    <a
                      href="https://www.trade-tariff.service.gov.uk/exchange_rates"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline hover:text-blue-900"
                    >
                      official HMRC exchange rates
                    </a>.
                    Hover over any GBP value to see the specific rate applied.
                  </p>
                  {!showFxInfo && (
                    <button
                      onClick={() => setShowFxInfo(true)}
                      className="mt-1 text-blue-600 hover:text-blue-800 underline text-sm"
                    >
                      Learn more about HMRC exchange rates
                    </button>
                  )}
                  {showFxInfo && (
                    <div className="mt-2 space-y-2">
                      <p>
                        <strong>Monthly Granularity:</strong> HMRC publishes one exchange rate per currency per month.
                        All transactions in the same month use the same official rate, as required for UK tax reporting.
                      </p>
                      <p>
                        <strong>Publication Schedule:</strong> Exchange rates are published by HMRC on the penultimate Thursday of every month.
                        These rates represent values as of midday the day before publication, and apply to the <em>following</em> calendar month.
                      </p>
                      <button
                        onClick={() => setShowFxInfo(false)}
                        className="text-blue-600 hover:text-blue-800 underline text-sm"
                      >
                        Hide details
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Symbol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price (GBP)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total (GBP)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                CGT Rule
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedTransactions.map((tx) => {
              // Determine if this transaction is relevant to CGT calculations
              // Only BUY/SELL transactions directly affect capital gains
              const isRelevant = tx.type === 'BUY' || tx.type === 'SELL'
              const isIncomplete = tx.incomplete && !tx.ignored
              const isIgnored = tx.ignored
              const hasFxError = !!tx.fx_error

              // Get tooltip for non-relevant transaction types
              const getNonRelevantTooltip = () => {
                if (tx.type === 'DIVIDEND') {
                  return 'Dividend income is subject to Income Tax, not Capital Gains Tax. Report dividends on your Self Assessment tax return if they exceed the dividend allowance.'
                }
                if (tx.type === 'FEE') {
                  return 'Fees are not directly included in CGT calculations. They may be deductible as an allowable cost when calculating gains/losses.'
                }
                if (tx.type === 'INTEREST') {
                  return 'Interest income is subject to Income Tax, not Capital Gains Tax. Not included in CGT calculations.'
                }
                if (tx.type === 'TRANSFER') {
                  return 'Transfers between accounts do not trigger capital gains events. Not included in CGT calculations.'
                }
                if (tx.type === 'TAX') {
                  return 'Tax withholdings are recorded for completeness but do not affect CGT calculations directly.'
                }
                return null
              }

              const nonRelevantTooltip = getNonRelevantTooltip()

              // Get CGT badge styling based on gain_group
              const getCGTBadge = () => {
                if (tx.gain_group === 'SAME_DAY') {
                  return { className: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Same Day', title: 'Matched same-day buy/sell (TCGA92/S105(1))' }
                }
                if (tx.gain_group === '30_DAY') {
                  return { className: 'bg-orange-100 text-orange-800 border-orange-300', label: '30-Day', title: 'Bed & breakfast rule - repurchased within 30 days (TCGA92/S106A(5))' }
                }
                if (tx.gain_group === 'SECTION_104') {
                  return { className: 'bg-green-100 text-green-800 border-green-300', label: 'Section 104', title: 'Section 104 pooled holdings (TCGA92/S104)' }
                }
                return null
              }

              const cgtBadge = getCGTBadge()
              const rowClassName = hasFxError ? 'bg-red-50' :
                                   isIgnored ? 'bg-gray-50 opacity-40' :
                                   isIncomplete ? 'bg-yellow-50' :
                                   (isRelevant ? '' : 'opacity-50')

              return (
                <tr key={tx.id} className={rowClassName}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tx.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {tx.symbol || '—'}
                      {hasFxError && (
                        <Tooltip content={tx.fx_error || 'FX rate error'}>
                          <svg className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </Tooltip>
                      )}
                      {isIgnored && !hasFxError && (
                        <Tooltip content="Ignored: Stock Plan Activity is incomplete. Use Charles Schwab Equity Awards file for complete transaction data. Not included in CGT calculations.">
                          <span className="inline-flex items-center cursor-help">
                            <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        </Tooltip>
                      )}
                      {isIncomplete && !hasFxError && !isIgnored && (
                        <Tooltip content="Missing price data - upload Equity Awards file for complete information">
                          <svg className="h-4 w-4 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        tx.type === 'BUY' ? 'bg-green-100 text-green-800' :
                        tx.type === 'SELL' ? 'bg-red-100 text-red-800' :
                        tx.type === 'DIVIDEND' ? 'bg-blue-100 text-blue-800' :
                        tx.type === 'INTEREST' ? 'bg-purple-100 text-purple-800' :
                        tx.type === 'TAX' ? 'bg-yellow-100 text-yellow-800' :
                        tx.type === 'TRANSFER' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {tx.type}
                      </span>
                      {nonRelevantTooltip && (
                        <Tooltip content={nonRelevantTooltip}>
                          <svg className="h-4 w-4 text-gray-400 cursor-help" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tx.quantity !== null ? tx.quantity.toFixed(2) : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tx.price !== null ? `$${tx.price.toFixed(2)}` : (isIncomplete ? <span className="text-yellow-600 font-medium">Missing</span> : '—')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {hasFxError ? (
                      <span className="text-red-600 font-medium">Error</span>
                    ) : tx.price_gbp !== null && tx.currency !== 'GBP' ? (
                      <Tooltip content={`FX Rate: ${tx.fx_rate.toFixed(4)} ${tx.currency}/GBP (${tx.fx_source} - ${tx.date.substring(0, 7)})`}>
                        <span className="cursor-help border-b border-dotted border-gray-400">
                          £{tx.price_gbp.toFixed(2)}
                        </span>
                      </Tooltip>
                    ) : tx.price_gbp !== null ? (
                      `£${tx.price_gbp.toFixed(2)}`
                    ) : isIncomplete ? (
                      <span className="text-yellow-600 font-medium">Missing</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tx.total !== null ? `$${tx.total.toFixed(2)}` : (isIncomplete ? <span className="text-yellow-600 font-medium">Missing</span> : '—')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {hasFxError ? (
                      <span className="text-red-600 font-medium">Error</span>
                    ) : tx.value_gbp !== null && tx.currency !== 'GBP' ? (
                      <Tooltip content={`FX Rate: ${tx.fx_rate.toFixed(4)} ${tx.currency}/GBP (${tx.fx_source} - ${tx.date.substring(0, 7)})`}>
                        <span className="cursor-help border-b border-dotted border-gray-400">
                          £{tx.value_gbp.toFixed(2)}
                        </span>
                      </Tooltip>
                    ) : tx.value_gbp !== null ? (
                      `£${tx.value_gbp.toFixed(2)}`
                    ) : isIncomplete ? (
                      <span className="text-yellow-600 font-medium">Missing</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {tx.source}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {cgtBadge ? (
                      <Tooltip content={cgtBadge.title}>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${cgtBadge.className}`}>
                          {cgtBadge.label}
                        </span>
                      </Tooltip>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
