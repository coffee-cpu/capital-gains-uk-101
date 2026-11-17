import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
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
  const isLoading = useTransactionStore((state) => state.isLoading)
  const [fileNames, setFileNames] = useState<string[]>([])

  // Follow the stored file list as it changes, including the sample portfolio
  // being dropped on start-up, which runs no recalculation. A liveQuery stops
  // after an error (e.g. a database reset), so subscribe again after each run
  useEffect(() => {
    const subscription = liveQuery(() => db.imported_files.orderBy('importedAt').toArray()).subscribe({
      next: files => setFileNames(files.map(f => f.filename)),
      error: () => { /* the list is informational; the next run subscribes again */ },
    })
    return () => subscription.unsubscribe()
  }, [cgtResults, isLoading])

  // Also shown when files are stored but the results aren't (e.g. a failed
  // recalculation), so there's always a way to start again
  if (transactionCount === 0 && fileNames.length === 0) return null

  // Imports from before file metadata was recorded have no file rows
  // Each count stays on one line, so a narrow row breaks between them
  const counts = [
    fileNames.length > 0 && `${fileNames.length} file${fileNames.length !== 1 ? 's' : ''}`,
    transactionCount > 0 && `${transactionCount} transaction${transactionCount !== 1 ? 's' : ''}`,
  ].filter((c): c is string => Boolean(c))

  return (
    <div
      data-testid="imported-files-summary"
      className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3"
    >
      <div className="min-w-0 text-sm text-gray-700">
        <span className="font-medium text-gray-900">
          {counts.map((c, i) => (
            <span key={c} className="whitespace-nowrap">{i > 0 && ' · '}{c}</span>
          ))}
        </span>
        {fileNames.length > 0 && (
          <span className="block truncate text-xs text-gray-500" title={fileNames.join(', ')}>
            {fileNames.join(', ')}
          </span>
        )}
      </div>
      <div className="shrink-0">
        <ClearDataButton fileCount={fileNames.length} transactionCount={transactionCount} />
      </div>
    </div>
  )
}
