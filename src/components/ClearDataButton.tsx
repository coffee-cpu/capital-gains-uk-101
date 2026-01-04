import { useState } from 'react'
import { db } from '../lib/db'
import { useTransactionStore } from '../stores/transactionStore'

interface ClearDataButtonProps {
  variant?: 'default' | 'compact'
}

export function ClearDataButton({ variant = 'default' }: ClearDataButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const setTransactions = useTransactionStore((state) => state.setTransactions)

  const handleClear = async () => {
    setIsClearing(true)
    try {
      // Delete entire IndexedDB database (handles schema migration issues)
      await db.delete()

      // Clear Zustand store
      setTransactions([])

      // Clear localStorage (Zustand persist)
      localStorage.removeItem('cgt-settings')

      setShowConfirm(false)

      // Reload page to ensure clean state
      window.location.reload()
    } catch (err) {
      console.error('Failed to clear data:', err)
      setIsClearing(false)
    }
  }

  // Compact variant for sidebar
  if (variant === 'compact') {
    if (!showConfirm) {
      return (
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-sm font-medium rounded-lg text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
          Clear All Data
        </button>
      )
    }

    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-red-700 font-medium text-center">Are you sure?</p>
        <button
          onClick={handleClear}
          disabled={isClearing}
          className="w-full px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isClearing ? 'Clearing...' : 'Yes, Delete'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isClearing}
          className="w-full px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  // Default variant for wider spaces (TransactionList header)
  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
      >
        <svg
          className="h-4 w-4 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
          />
        </svg>
        Clear All Data
      </button>
    )
  }

  return (
    <div className="inline-flex items-center space-x-3">
      <span className="text-sm text-red-700 font-medium">Are you sure?</span>
      <button
        onClick={handleClear}
        disabled={isClearing}
        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isClearing ? 'Clearing...' : 'Yes, Delete Everything'}
      </button>
      <button
        onClick={() => setShowConfirm(false)}
        disabled={isClearing}
        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  )
}
