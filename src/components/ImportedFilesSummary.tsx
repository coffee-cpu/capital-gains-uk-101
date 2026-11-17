import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { useTransactionStore, selectTransactions } from '../stores/transactionStore'
import { ClearDataButton } from './ClearDataButton'

/**
 * What's been imported so far, and the one place to clear it.
 * Shown in the import panel once there is data.
 */
export function ImportedFilesSummary() {
  const transactionCount = useTransactionStore((state) => selectTransactions(state).length)
  const cgtResults = useTransactionStore((state) => state.cgtResults)
  const [fileNames, setFileNames] = useState<string[]>([])

  // Every import or clear recalculates, so reload the file list with the results
  useEffect(() => {
    let cancelled = false
    db.imported_files.orderBy('importedAt').toArray()
      .then(files => { if (!cancelled) setFileNames(files.map(f => f.filename)) })
      .catch(() => { /* the list is informational */ })
    return () => { cancelled = true }
  }, [cgtResults])

  if (transactionCount === 0) return null

  return (
    <div
      data-testid="imported-files-summary"
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3"
    >
      <div className="min-w-0 text-sm text-gray-700">
        <span className="font-medium text-gray-900">
          {fileNames.length} file{fileNames.length !== 1 ? 's' : ''} · {transactionCount} transactions
        </span>
        {fileNames.length > 0 && (
          <span className="block truncate text-xs text-gray-500" title={fileNames.join(', ')}>
            {fileNames.join(', ')}
          </span>
        )}
      </div>
      <div className="shrink-0">
        <ClearDataButton />
      </div>
    </div>
  )
}
