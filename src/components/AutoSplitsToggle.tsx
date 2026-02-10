import { useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { useTransactionStore } from '../stores/transactionStore'
import { processTransactionsFromDB } from '../lib/transactionProcessor'
import { Tooltip } from './Tooltip'

/**
 * Toggle for enabling/disabling auto-detected stock splits.
 * When toggled, re-processes all transactions to include/exclude auto-splits.
 */
export function AutoSplitsToggle() {
  const { autoSplitsEnabled, setAutoSplitsEnabled, fxSource } = useSettingsStore()
  const { setTransactions, setCGTResults, setIsLoading, transactions } = useTransactionStore()
  const [isChanging, setIsChanging] = useState(false)

  // Only show when there are transactions
  if (transactions.length === 0) return null

  const handleToggle = async () => {
    if (isChanging) return

    const newValue = !autoSplitsEnabled
    setIsChanging(true)
    setIsLoading(true)

    try {
      await setAutoSplitsEnabled(newValue)

      const cgtResults = await processTransactionsFromDB(fxSource, newValue)
      if (cgtResults) {
        setTransactions(cgtResults.transactions)
        setCGTResults(cgtResults)
      }
    } catch (error) {
      console.error('Failed to toggle auto-splits:', error)
      await setAutoSplitsEnabled(!newValue)
    } finally {
      setIsChanging(false)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Tooltip content="Fetch stock split data from community-maintained sources (coffee-cpu/stock-splits-data). When enabled, missing splits are applied for correct CGT calculations. This data may be incomplete — you can also upload your own splits via Generic CSV.">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <span className="text-gray-600 whitespace-nowrap">Community split data</span>
          <button
            role="switch"
            aria-checked={autoSplitsEnabled}
            onClick={handleToggle}
            disabled={isChanging}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
              isChanging ? 'cursor-wait opacity-50' : 'cursor-pointer'
            } ${autoSplitsEnabled ? 'bg-teal-600' : 'bg-gray-200'}`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                autoSplitsEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </Tooltip>
    </div>
  )
}
