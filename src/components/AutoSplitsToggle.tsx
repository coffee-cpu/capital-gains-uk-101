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
      <Tooltip content="Fetch stock split data from community-maintained sources. When enabled, missing splits are applied for correct CGT calculations. This data may be incomplete — you can also upload your own splits via Generic CSV.">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <a
            href="https://github.com/coffee-cpu/stock-splits-data"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-gray-600 hover:text-teal-700 whitespace-nowrap"
          >
            Community split data
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="inline w-3 h-3 -mt-0.5 ml-0.5">
              <path d="M8.75 4h3.19L6.22 9.72a.75.75 0 1 0 1.06 1.06L13 5.06v3.19a.75.75 0 0 0 1.5 0V3.75a.75.75 0 0 0-.75-.75H9.5a.75.75 0 0 0 0 1.5h-.75Z" />
              <path d="M3.5 6.75c0-.69.56-1.25 1.25-1.25H7A.75.75 0 0 0 7 4H4.75A2.75 2.75 0 0 0 2 6.75v4.5A2.75 2.75 0 0 0 4.75 14h4.5A2.75 2.75 0 0 0 12 11.25V9a.75.75 0 0 0-1.5 0v2.25c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-4.5Z" />
            </svg>
          </a>
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
