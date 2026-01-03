import { useState } from 'react'
import {
  FXStrategy,
  FXStrategyDisplayNames,
  FXStrategyDescriptions,
  FXStrategySourceUrls,
} from '../types/fxStrategy'
import { useSettingsStore } from '../stores/settingsStore'
import { useTransactionStore } from '../stores/transactionStore'
import { db } from '../lib/db'
import { enrichTransactions } from '../lib/enrichment'
import { calculateCGT } from '../lib/cgt/engine'

/**
 * FX Strategy Selector Component
 *
 * Allows users to select their preferred FX conversion strategy.
 * When changed, re-enriches all transactions with the new strategy.
 *
 * HMRC Guidance (CG78310):
 * "HMRC does not prescribe what reference point should be used for the exchange rate.
 * It is, however, expected that a reasonable and consistent method is used."
 */
export function FXStrategySelector() {
  const { fxStrategy, setFXStrategy } = useSettingsStore()
  const { setTransactions, setCGTResults, setIsLoading } = useTransactionStore()
  const [isChanging, setIsChanging] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const strategies: FXStrategy[] = ['HMRC_MONTHLY', 'HMRC_YEARLY_AVG', 'DAILY_SPOT']

  const handleStrategyChange = async (newStrategy: FXStrategy) => {
    if (newStrategy === fxStrategy || isChanging) return

    setIsOpen(false)
    setIsChanging(true)
    setIsLoading(true)

    try {
      // Update the setting
      await setFXStrategy(newStrategy)

      // Get raw transactions from DB
      const rawTransactions = await db.transactions.toArray()

      if (rawTransactions.length > 0) {
        // Re-enrich with new strategy
        const enriched = await enrichTransactions(rawTransactions, newStrategy)

        // Re-calculate CGT
        const cgtResults = calculateCGT(enriched)

        // Update stores
        setTransactions(cgtResults.transactions)
        setCGTResults(cgtResults)
      }
    } catch (error) {
      console.error('Failed to change FX strategy:', error)
      // Revert to previous strategy on error
      await setFXStrategy(fxStrategy)
    } finally {
      setIsChanging(false)
      setIsLoading(false)
    }
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isChanging}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
          isChanging
            ? 'bg-gray-100 text-gray-400 cursor-wait'
            : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50 hover:border-blue-400'
        }`}
      >
        {isChanging ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Recalculating...
          </>
        ) : (
          <>
            {FXStrategyDisplayNames[fxStrategy]}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {isOpen && !isChanging && (
        <>
          {/* Backdrop to close dropdown when clicking outside */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 z-20 mt-2 w-80 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="py-1">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs text-gray-500">
                  HMRC allows any reasonable & consistent method.{' '}
                  <a
                    href="https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg78310"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Learn more
                  </a>
                </p>
              </div>

              {strategies.map((strategy) => (
                <button
                  key={strategy}
                  onClick={() => handleStrategyChange(strategy)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    strategy === fxStrategy ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium ${strategy === fxStrategy ? 'text-blue-700' : 'text-gray-900'}`}
                        >
                          {FXStrategyDisplayNames[strategy]}
                        </span>
                        {strategy === fxStrategy && (
                          <svg
                            className="h-4 w-4 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {FXStrategyDescriptions[strategy]}
                      </p>
                    </div>
                  </div>
                  <a
                    href={FXStrategySourceUrls[strategy]}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                  >
                    View source
                  </a>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
