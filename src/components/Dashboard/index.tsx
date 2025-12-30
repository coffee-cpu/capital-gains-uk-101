import { useMemo, useState } from 'react'
import { useTransactionStore } from '../../stores/transactionStore'
import { TransactionsChart } from './TransactionsChart'
import { PoolBreakdownChart } from './PoolBreakdownChart'
import {
  buildTransactionTimeline,
  buildPoolBreakdownData,
  buildCurrentHoldingsData,
} from '../../lib/chartData'
import { Section104Pool } from '../../types/cgt'
import { EnrichedTransaction } from '../../types/transaction'

// Stable empty references to prevent infinite re-renders
const EMPTY_POOLS = new Map<string, Section104Pool>()
const EMPTY_TRANSACTIONS: EnrichedTransaction[] = []

type ChartType = 'transactions' | 'section104'

const CHART_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'transactions', label: 'Transactions' },
  { value: 'section104', label: 'Section 104 Pools' },
]

export function Dashboard() {
  const [selectedChart, setSelectedChart] = useState<ChartType>('transactions')
  const cgtResults = useTransactionStore((state) => state.cgtResults)

  // Get data with stable fallbacks
  const disposals = cgtResults?.disposals ?? []
  const section104Pools = cgtResults?.section104Pools ?? EMPTY_POOLS
  const transactions = cgtResults?.transactions ?? EMPTY_TRANSACTIONS

  // Memoize chart data transformations
  const transactionData = useMemo(
    () => buildTransactionTimeline(transactions, disposals),
    [transactions, disposals]
  )

  const poolData = useMemo(
    () => buildPoolBreakdownData(section104Pools),
    [section104Pools]
  )

  const holdingsData = useMemo(
    () => buildCurrentHoldingsData(section104Pools),
    [section104Pools]
  )

  // Don't render if no data
  const hasData = disposals.length > 0 || section104Pools.size > 0 || transactions.length > 0

  if (!hasData) {
    return null
  }

  const renderChart = () => {
    switch (selectedChart) {
      case 'section104':
        return <PoolBreakdownChart data={poolData} holdingsData={holdingsData} />
      case 'transactions':
        return <TransactionsChart data={transactionData} />
    }
  }

  return (
    <div className="hidden md:block">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* Header with chart selector */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Timeline</h3>

          {/* Chart type selector */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {CHART_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedChart(option.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  selectedChart === option.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart content */}
        <div className="p-6">
          {renderChart()}
        </div>
      </div>
    </div>
  )
}
