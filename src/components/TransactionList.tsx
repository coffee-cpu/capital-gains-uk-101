import { useState } from 'react'
import { useTransactionStore } from '../stores/transactionStore'
import { ClearDataButton } from './ClearDataButton'
import { Tooltip } from './Tooltip'
import { FXSourceSelector } from './FXSourceSelector'
import { exportTransactionsToCSV } from '../utils/csvExport'
import { isAcquisition, isDisposal, getUnitLabel } from '../lib/cgt/utils'

// Helper to get currency symbol
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    'GBP': '£',
    'USD': '$',
    'EUR': '€',
    'JPY': '¥',
    'CHF': 'CHF ',
    'CAD': 'CA$',
    'AUD': 'A$',
  }
  return symbols[currency] || currency + ' '
}

// Helper to format date for FX tooltip based on source type
function formatFxDate(date: string, fxSource: string): string {
  if (fxSource.includes('Annual')) {
    // Yearly average - show just the year
    return date.substring(0, 4)
  } else if (fxSource.includes('European Central Bank') || fxSource.includes('Daily')) {
    // Daily spot rates - show full date
    return date
  }
  // Monthly rates - show year-month
  return date.substring(0, 7)
}

export function TransactionList() {
  const transactions = useTransactionStore((state) => state.transactions)
  const isLoading = useTransactionStore((state) => state.isLoading)
  const getDisposals = useTransactionStore((state) => state.getDisposals)
  const getSection104Pools = useTransactionStore((state) => state.getSection104Pools)
  const toggleHelpPanelWithContext = useTransactionStore((state) => state.toggleHelpPanelWithContext)
  const [showFxInfo, setShowFxInfo] = useState(false)
  const [hoveredMatchGroup, setHoveredMatchGroup] = useState<string | null>(null)

  // Get disposal records and Section 104 pools
  const disposals = getDisposals()
  const section104Pools = getSection104Pools()

  // Helper to get help context for a badge label
  const getContextForBadge = (label: string) => {
    if (label === 'Same Day') return 'same-day'
    if (label === '30-Day') return '30-day'
    if (label === 'Section 104') return 'section104'
    if (label === 'Incomplete') return 'incomplete'
    return 'default'
  }

  // Handle badge click - toggle help panel with context
  const handleBadgeClick = (e: React.MouseEvent, badgeLabel: string) => {
    e.stopPropagation() // Prevent click from bubbling to document (which would close the panel)
    const context = getContextForBadge(badgeLabel)
    toggleHelpPanelWithContext(context as any)
  }

  // Helper to find disposal record for a transaction
  const getDisposalForTransaction = (txId: string) => {
    return disposals.find(d => d.disposal.id === txId)
  }

  // Helper to get pool details for a BUY transaction
  const getPoolDetailsForBuy = (txId: string, symbol: string) => {
    const pool = section104Pools.get(symbol)
    if (!pool || !pool.history) return null

    const historyEntry = pool.history.find(h => h.transactionId === txId && h.type === 'BUY')
    if (!historyEntry) return null

    return {
      quantity: historyEntry.balanceQuantity,
      averageCost: historyEntry.balanceQuantity > 0
        ? historyEntry.balanceCost / historyEntry.balanceQuantity
        : 0,
    }
  }

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

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4 font-medium">Loading your previously uploaded transactions...</p>
          <p className="text-gray-500 text-sm mt-2">Applying FX rates and calculating CGT rules</p>
        </div>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-500 text-center">No transactions imported yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Transactions</h2>
            <p className="text-sm text-gray-500 mt-1">{transactions.length} total</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportTransactionsToCSV(transactions)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              title="Export transactions as Generic CSV"
            >
              <svg className="h-4 w-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">Export Generic CSV</span>
            </button>
            <ClearDataButton />
          </div>
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
                  <strong>Try a different FX source</strong> using the dropdown on the right. Some sources have limited historical data availability.
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
                  <strong>Action required:</strong> Upload your Charles Schwab Equity Awards transaction history (a separate file from the regular Schwab transaction export) to get complete pricing information. See "Supported formats & export guides" in the Import section for instructions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile viewing notice */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 md:hidden">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-gray-700">
              It works on mobile but looks better on a bigger screen
            </p>
          </div>
        </div>
      </div>

      {/* FX Rate Information - show if any non-GBP transactions (even if FX failed) */}
      {transactions.some(tx => tx.currency !== 'GBP') && (
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex flex-1">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <div className="text-sm text-blue-700">
                  <p>
                    Foreign currency values converted to GBP. Hover over any GBP value to see the rate applied.
                  </p>
                  {!showFxInfo && (
                    <button
                      onClick={() => setShowFxInfo(true)}
                      className="mt-1 text-blue-600 hover:text-blue-800 underline text-sm"
                    >
                      Learn more about exchange rate options
                    </button>
                  )}
                  {showFxInfo && (
                    <div className="mt-2 space-y-2">
                      <p>
                        <strong>HMRC Guidance:</strong>{' '}
                        <a
                          href="https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg78310"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-blue-900"
                        >
                          CG78310
                        </a>{' '}
                        states that HMRC does not prescribe a specific exchange rate source.
                        A &quot;reasonable and consistent method&quot; is expected across all transactions.
                      </p>
                      <p>
                        <strong>Available Options:</strong> HMRC Monthly Rates (one rate per month),
                        HMRC Yearly Average (annual averages), or Daily Spot Rates (ECB rates for each transaction date).
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
            <div className="flex-shrink-0 self-end sm:self-auto">
              <FXSourceSelector />
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-blue-50 z-10">
                <div className="flex items-center gap-1.5">
                  <Tooltip content="CGT Rule indicates how HMRC matches this transaction for Capital Gains Tax calculation: Same Day (same calendar day), 30-Day (bed & breakfast rule), or Section 104 (pooled holdings)">
                    <span className="cursor-help border-b border-dotted border-gray-500">
                      CGT Rule
                    </span>
                  </Tooltip>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleHelpPanelWithContext('default')
                    }}
                    className="p-0.5 rounded hover:bg-blue-100 transition-colors"
                    aria-label="Learn about CGT rules"
                  >
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </th>
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
                Fee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fee (GBP)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedTransactions.map((tx) => {
              // Determine if this transaction is relevant to CGT calculations
              // BUY/SELL and options transactions directly affect capital gains
              const isRelevant = isAcquisition(tx) || isDisposal(tx)
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
                if (tx.type === 'STOCK_SPLIT') {
                  return 'Stock splits are treated as share reorganisations under HMRC TCGA92/S127. This split adjusts all transactions for this stock before the split date to post-split quantities for CGT calculations. No disposal occurs.'
                }
                return null
              }

              const nonRelevantTooltip = getNonRelevantTooltip()

              // Get CGT badges - Both disposal and acquisition transactions can have multiple rules
              const getCGTBadges = () => {
                const badges: Array<{ className: string; label: string; title: string }> = []

                if (isDisposal(tx)) {
                  // For disposal transactions, show all matching rules from DisposalRecord
                  const disposal = getDisposalForTransaction(tx.id)

                  // Add warning badge if disposal is incomplete (insufficient acquisition data)
                  if (disposal?.isIncomplete && disposal.unmatchedQuantity) {
                    const hasSplit = tx.split_multiplier && tx.split_multiplier !== 1.0
                    let tooltip: string
                    if (hasSplit && tx.split_multiplier) {
                      const originalUnmatched = disposal.unmatchedQuantity / tx.split_multiplier
                      tooltip = `Warning: ${originalUnmatched.toFixed(2)} ${getUnitLabel(tx)} (${disposal.unmatchedQuantity.toFixed(2)} split-adjusted) could not be matched to any acquisitions. Missing acquisition data - did you buy ${getUnitLabel(tx)} before you started importing transactions?`
                    } else {
                      tooltip = `Warning: ${disposal.unmatchedQuantity.toFixed(2)} ${getUnitLabel(tx)} could not be matched to any acquisitions. Missing acquisition data - did you buy ${getUnitLabel(tx)} before you started importing transactions?`
                    }
                    badges.push({
                      className: 'bg-red-100 text-red-800 border-red-300',
                      label: 'Incomplete',
                      title: tooltip
                    })
                  }

                  if (disposal && disposal.matchings.length > 0) {
                    for (const matching of disposal.matchings) {
                      if (matching.rule === 'SAME_DAY') {
                        const quantityMatched = matching.quantityMatched
                        const hasSplit = tx.split_multiplier && tx.split_multiplier !== 1.0
                        let tooltip: string
                        if (hasSplit && tx.split_multiplier) {
                          const originalMatched = quantityMatched / tx.split_multiplier
                          tooltip = `Same Day: Matched ${originalMatched.toFixed(2)} ${getUnitLabel(tx)} (${quantityMatched.toFixed(2)} split-adjusted) bought on same day (TCGA92/S105(1))`
                        } else {
                          tooltip = `Same Day: Matched ${quantityMatched.toFixed(2)} ${getUnitLabel(tx)} bought on same day (TCGA92/S105(1))`
                        }
                        badges.push({
                          className: 'bg-blue-100 text-blue-800 border-blue-300',
                          label: 'Same Day',
                          title: tooltip
                        })
                      } else if (matching.rule === '30_DAY') {
                        const quantityMatched = matching.quantityMatched
                        const hasSplit = tx.split_multiplier && tx.split_multiplier !== 1.0
                        let tooltip: string
                        if (hasSplit && tx.split_multiplier) {
                          const originalMatched = quantityMatched / tx.split_multiplier
                          tooltip = `30-Day: Matched ${originalMatched.toFixed(2)} ${getUnitLabel(tx)} (${quantityMatched.toFixed(2)} split-adjusted) repurchased within 30 days (TCGA92/S106A(5))`
                        } else {
                          tooltip = `30-Day: Matched ${quantityMatched.toFixed(2)} ${getUnitLabel(tx)} repurchased within 30 days (TCGA92/S106A(5))`
                        }
                        badges.push({
                          className: 'bg-orange-100 text-orange-800 border-orange-300',
                          label: '30-Day',
                          title: tooltip
                        })
                      } else if (matching.rule === 'SHORT_SELL') {
                        const quantityMatched = matching.quantityMatched
                        const hasSplit = tx.split_multiplier && tx.split_multiplier !== 1.0
                        let tooltip: string
                        if (hasSplit && tx.split_multiplier) {
                          const originalMatched = quantityMatched / tx.split_multiplier
                          tooltip = `Short Sell: ${originalMatched.toFixed(2)} ${getUnitLabel(tx)} (${quantityMatched.toFixed(2)} split-adjusted) sold short and covered by subsequent purchase`
                        } else {
                          tooltip = `Short Sell: ${quantityMatched.toFixed(2)} ${getUnitLabel(tx)} sold short and covered by subsequent purchase`
                        }
                        badges.push({
                          className: 'bg-pink-100 text-pink-800 border-pink-300',
                          label: 'Short Sell',
                          title: tooltip
                        })
                      } else if (matching.rule === 'SECTION_104' && matching.quantityMatched > 0) {
                        // Only show Section 104 badge if some quantity was actually matched
                        const quantityMatched = matching.quantityMatched
                        const avgCost = matching.totalCostBasisGbp / quantityMatched

                        // Check if disposal has split adjustments
                        const hasSplit = tx.split_multiplier && tx.split_multiplier !== 1.0
                        let tooltip: string

                        if (hasSplit && tx.split_multiplier) {
                          // quantityMatched is split-adjusted, calculate original
                          const originalMatched = quantityMatched / tx.split_multiplier
                          tooltip = `Section 104: Matched ${originalMatched.toFixed(2)} ${getUnitLabel(tx)} (${quantityMatched.toFixed(2)} split-adjusted) at average cost £${avgCost.toFixed(2)}/${getUnitLabel(tx, false)} from pooled holdings`
                        } else {
                          tooltip = `Section 104: Matched ${quantityMatched.toFixed(2)} ${getUnitLabel(tx)} at average cost £${avgCost.toFixed(2)}/${getUnitLabel(tx, false)} from pooled holdings`
                        }

                        badges.push({
                          className: 'bg-green-100 text-green-800 border-green-300',
                          label: 'Section 104',
                          title: tooltip
                        })
                      }
                    }
                  }
                } else if (isAcquisition(tx)) {
                  // For acquisition transactions, find all matchings where this is an acquisition
                  const allDisposals = disposals // Use cached disposals instead of calling getDisposals() again
                  let totalMatched = 0
                  const ruleQuantities: Map<string, number> = new Map()

                  // Find all matchings that use this BUY transaction
                  for (const disposal of allDisposals) {
                    for (const matching of disposal.matchings) {
                      for (const acq of matching.acquisitions) {
                        if (acq.transaction.id === tx.id) {
                          totalMatched += acq.quantityMatched
                          const existingQty = ruleQuantities.get(matching.rule) || 0
                          ruleQuantities.set(matching.rule, existingQty + acq.quantityMatched)
                        }
                      }
                    }
                  }

                  // Add badges for each rule this BUY participates in
                  const hasSplit = tx.split_multiplier && tx.split_multiplier !== 1.0
                  for (const [rule, qty] of ruleQuantities.entries()) {
                    if (rule === 'SAME_DAY') {
                      let tooltip: string
                      if (hasSplit && tx.split_multiplier) {
                        const originalQty = qty / tx.split_multiplier
                        tooltip = `Same Day: ${originalQty.toFixed(2)} ${getUnitLabel(tx)} (${qty.toFixed(2)} split-adjusted) matched to same-day disposal (TCGA92/S105(1))`
                      } else {
                        tooltip = `Same Day: ${qty.toFixed(2)} ${getUnitLabel(tx)} matched to same-day disposal (TCGA92/S105(1))`
                      }
                      badges.push({
                        className: 'bg-blue-100 text-blue-800 border-blue-300',
                        label: 'Same Day',
                        title: tooltip
                      })
                    } else if (rule === '30_DAY') {
                      let tooltip: string
                      if (hasSplit && tx.split_multiplier) {
                        const originalQty = qty / tx.split_multiplier
                        tooltip = `30-Day: ${originalQty.toFixed(2)} ${getUnitLabel(tx)} (${qty.toFixed(2)} split-adjusted) matched to disposal (bed & breakfast rule TCGA92/S106A(5))`
                      } else {
                        tooltip = `30-Day: ${qty.toFixed(2)} ${getUnitLabel(tx)} matched to disposal (bed & breakfast rule TCGA92/S106A(5))`
                      }
                      badges.push({
                        className: 'bg-orange-100 text-orange-800 border-orange-300',
                        label: '30-Day',
                        title: tooltip
                      })
                    } else if (rule === 'SHORT_SELL') {
                      let tooltip: string
                      if (hasSplit && tx.split_multiplier) {
                        const originalQty = qty / tx.split_multiplier
                        tooltip = `Short Sell: ${originalQty.toFixed(2)} ${getUnitLabel(tx)} (${qty.toFixed(2)} split-adjusted) used to cover a short sell`
                      } else {
                        tooltip = `Short Sell: ${qty.toFixed(2)} ${getUnitLabel(tx)} used to cover a short sell`
                      }
                      badges.push({
                        className: 'bg-pink-100 text-pink-800 border-pink-300',
                        label: 'Short Sell',
                        title: tooltip
                      })
                    }
                  }

                  // Check if remaining shares went to Section 104 pool
                  const remainingQty = (tx.split_adjusted_quantity ?? tx.quantity ?? 0) - totalMatched
                  if (remainingQty > 0) {
                    const poolDetails = tx.symbol ? getPoolDetailsForBuy(tx.id, tx.symbol) : null
                    const hasSplit = tx.split_multiplier && tx.split_multiplier !== 1.0

                    let tooltip: string
                    if (poolDetails) {
                      if (hasSplit && tx.split_multiplier) {
                        const originalRemaining = remainingQty / tx.split_multiplier
                        tooltip = `Section 104: ${originalRemaining.toFixed(2)} ${getUnitLabel(tx)} (${remainingQty.toFixed(2)} split-adjusted) added to pool (new balance: ${poolDetails.quantity.toFixed(2)} split-adjusted ${getUnitLabel(tx)} at £${poolDetails.averageCost.toFixed(2)}/${getUnitLabel(tx, false)} average cost)`
                      } else {
                        tooltip = `Section 104: ${remainingQty.toFixed(2)} ${getUnitLabel(tx)} added to pool (new balance: ${poolDetails.quantity.toFixed(2)} ${getUnitLabel(tx)} at £${poolDetails.averageCost.toFixed(2)}/${getUnitLabel(tx, false)} average cost)`
                      }
                      badges.push({
                        className: 'bg-green-100 text-green-800 border-green-300',
                        label: 'Section 104',
                        title: tooltip
                      })
                    } else {
                      if (hasSplit && tx.split_multiplier) {
                        const originalRemaining = remainingQty / tx.split_multiplier
                        tooltip = `Section 104: ${originalRemaining.toFixed(2)} ${getUnitLabel(tx)} (${remainingQty.toFixed(2)} split-adjusted) added to pooled holdings (TCGA92/S104)`
                      } else {
                        tooltip = `Section 104: ${remainingQty.toFixed(2)} ${getUnitLabel(tx)} added to pooled holdings (TCGA92/S104)`
                      }
                      badges.push({
                        className: 'bg-green-100 text-green-800 border-green-300',
                        label: 'Section 104',
                        title: tooltip
                      })
                    }
                  }
                }

                return badges.length > 0 ? badges : null
              }

              const cgtBadges = getCGTBadges()

              // Check if this transaction is part of a match group
              const matchGroups = tx.match_groups || []
              const isHighlighted = matchGroups.includes(hoveredMatchGroup || '')
              const shouldDim = hoveredMatchGroup && !isHighlighted

              const rowClassName = hasFxError ? 'bg-red-50' :
                                   isIgnored ? 'bg-gray-50 opacity-40' :
                                   isIncomplete ? 'bg-yellow-50' :
                                   isHighlighted ? 'bg-blue-100 ring-2 ring-blue-400' :
                                   shouldDim ? 'opacity-30' :
                                   (isRelevant ? '' : 'opacity-50')

              return (
                <tr
                  key={tx.id}
                  className={`transition-all duration-150 ${rowClassName}`}
                  onMouseEnter={() => matchGroups.length > 0 && setHoveredMatchGroup(matchGroups[0])}
                  onMouseLeave={() => setHoveredMatchGroup(null)}
                >
                  <td className={`px-6 py-4 text-sm sticky left-0 z-10 transition-all duration-150 ${
                    hasFxError ? 'bg-red-100' :
                    isIgnored ? 'bg-gray-100' :
                    isIncomplete ? 'bg-yellow-100' :
                    isHighlighted ? 'bg-blue-100' :
                    'bg-blue-50'
                  }`}>
                    {cgtBadges ? (
                      <div className="flex flex-wrap gap-1">
                        {cgtBadges.map((badge, index) => (
                          <Tooltip key={index} content={badge.title}>
                            <span
                              className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full border whitespace-nowrap cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all ${badge.className}`}
                              onClick={(e) => handleBadgeClick(e, badge.label)}
                            >
                              {badge.label}
                            </span>
                          </Tooltip>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
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
                        <Tooltip content="Ignored: Stock Plan Activity is incomplete. Upload Charles Schwab Equity Awards file for complete transaction data (see 'Supported formats & export guides' in the Import section).">
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
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          tx.type === 'BUY' ? 'bg-green-100 text-green-800' :
                          tx.type === 'SELL' ? 'bg-red-100 text-red-800' :
                          tx.type === 'OPTIONS_BUY_TO_OPEN' ? 'bg-green-100 text-green-800' :
                          tx.type === 'OPTIONS_BUY_TO_CLOSE' ? 'bg-green-100 text-green-800' :
                          tx.type === 'OPTIONS_SELL_TO_OPEN' ? 'bg-red-100 text-red-800' :
                          tx.type === 'OPTIONS_SELL_TO_CLOSE' ? 'bg-red-100 text-red-800' :
                          tx.type === 'OPTIONS_ASSIGNED' ? 'bg-red-100 text-red-800' :
                          tx.type === 'OPTIONS_EXPIRED' ? 'bg-gray-100 text-gray-800' :
                          tx.type === 'OPTIONS_STOCK_SPLIT' ? 'bg-indigo-100 text-indigo-800' :
                          tx.type === 'DIVIDEND' ? 'bg-blue-100 text-blue-800' :
                          tx.type === 'INTEREST' ? 'bg-purple-100 text-purple-800' :
                          tx.type === 'TAX' ? 'bg-yellow-100 text-yellow-800' :
                          tx.type === 'TRANSFER' ? 'bg-orange-100 text-orange-800' :
                          tx.type === 'STOCK_SPLIT' ? 'bg-indigo-100 text-indigo-800 cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-indigo-400 transition-all' :
                          'bg-gray-100 text-gray-800'
                        }`}
                        onClick={tx.type === 'STOCK_SPLIT' ? (e) => {
                          e.stopPropagation()
                          toggleHelpPanelWithContext('stock-split' as any)
                        } : undefined}
                      >
                        {tx.type}
                      </span>
                      {tx.type === 'STOCK_SPLIT' && tx.ratio && (
                        <span className="text-xs text-gray-600 font-mono">
                          {tx.ratio}
                        </span>
                      )}
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
                    {tx.quantity !== null ? (
                      <div className="flex items-center gap-2">
                        <span>{tx.quantity.toFixed(2)}</span>
                        {tx.split_multiplier && tx.split_multiplier !== 1.0 && tx.split_adjusted_quantity != null && (() => {
                          // Get split dates by looking up split transaction IDs
                          const splitDates = tx.applied_splits
                            ?.map(splitId => transactions.find(t => t.id === splitId)?.date)
                            .filter(Boolean)
                            .join(', ') || ''
                          const splitCount = tx.applied_splits?.length || 0
                          const splitText = splitCount === 1 ? 'split' : 'splits'
                          const dateText = splitDates ? ` on ${splitDates}` : ''

                          return (
                            <Tooltip content={`Split-adjusted quantity: ${tx.split_adjusted_quantity.toFixed(2)} ${getUnitLabel(tx)} (${tx.split_multiplier}x multiplier from ${splitCount} ${splitText}${dateText})`}>
                              <div className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200 cursor-help">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                <span className="font-mono">{tx.split_adjusted_quantity.toFixed(0)}</span>
                              </div>
                            </Tooltip>
                          )
                        })()}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tx.price !== null ? (
                      <div className="flex items-center gap-2">
                        <span>{getCurrencySymbol(tx.currency)}{tx.price.toFixed(2)}</span>
                        {tx.split_multiplier && tx.split_multiplier !== 1.0 && tx.split_adjusted_price != null && (
                          <Tooltip content={`Split-adjusted price: ${getCurrencySymbol(tx.currency)}${tx.split_adjusted_price.toFixed(2)}/${getUnitLabel(tx, false)} (original price ÷ ${tx.split_multiplier})`}>
                            <div className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200 cursor-help">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17l-5-5m0 0l5-5m-5 5h12" />
                              </svg>
                              <span className="font-mono">{getCurrencySymbol(tx.currency)}{tx.split_adjusted_price.toFixed(2)}</span>
                            </div>
                          </Tooltip>
                        )}
                      </div>
                    ) : (isIncomplete ? <span className="text-yellow-600 font-medium">Missing</span> : '—')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {hasFxError ? (
                      <span className="text-red-600 font-medium">Error</span>
                    ) : tx.price_gbp !== null ? (
                      <div className="flex items-center gap-2">
                        {tx.currency !== 'GBP' ? (
                          <Tooltip content={`FX Rate: ${tx.fx_rate.toFixed(4)} ${tx.currency}/GBP (${tx.fx_source} - ${formatFxDate(tx.date, tx.fx_source)})`}>
                            <span className="cursor-help border-b border-dotted border-gray-400">
                              £{tx.price_gbp.toFixed(2)}
                            </span>
                          </Tooltip>
                        ) : (
                          <span>£{tx.price_gbp.toFixed(2)}</span>
                        )}
                        {tx.split_multiplier && tx.split_multiplier !== 1.0 && tx.split_adjusted_price_gbp !== null && tx.split_adjusted_price_gbp !== undefined && (
                          <Tooltip content={`Split-adjusted price: £${tx.split_adjusted_price_gbp.toFixed(2)}/${getUnitLabel(tx, false)} (original price ÷ ${tx.split_multiplier})`}>
                            <div className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200 cursor-help">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17l-5-5m0 0l5-5m-5 5h12" />
                              </svg>
                              <span className="font-mono">£{tx.split_adjusted_price_gbp.toFixed(2)}</span>
                            </div>
                          </Tooltip>
                        )}
                      </div>
                    ) : isIncomplete ? (
                      <span className="text-yellow-600 font-medium">Missing</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tx.total !== null ? `${getCurrencySymbol(tx.currency)}${tx.total.toFixed(2)}` : (isIncomplete ? <span className="text-yellow-600 font-medium">Missing</span> : '—')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {hasFxError ? (
                      <span className="text-red-600 font-medium">Error</span>
                    ) : tx.value_gbp !== null && tx.currency !== 'GBP' ? (
                      <Tooltip content={`FX Rate: ${tx.fx_rate.toFixed(4)} ${tx.currency}/GBP (${tx.fx_source} - ${formatFxDate(tx.date, tx.fx_source)})`}>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tx.fee !== null && tx.fee !== 0 ? `${getCurrencySymbol(tx.currency)}${tx.fee.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {hasFxError ? (
                      <span className="text-red-600 font-medium">Error</span>
                    ) : tx.fee_gbp !== null && tx.fee_gbp !== 0 && tx.currency !== 'GBP' ? (
                      <Tooltip content={`FX Rate: ${tx.fx_rate.toFixed(4)} ${tx.currency}/GBP (${tx.fx_source} - ${formatFxDate(tx.date, tx.fx_source)})`}>
                        <span className="cursor-help border-b border-dotted border-gray-400">
                          £{tx.fee_gbp.toFixed(2)}
                        </span>
                      </Tooltip>
                    ) : tx.fee_gbp !== null && tx.fee_gbp !== 0 ? (
                      `£${tx.fee_gbp.toFixed(2)}`
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {tx.source}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
        <div className="absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none"></div>
      </div>
    </div>
  )
}
