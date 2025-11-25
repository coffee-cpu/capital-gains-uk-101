import { useState } from 'react'

interface SessionResumeDialogProps {
  transactionCount: number
  lastUpdated: Date | null
  fileSources: string[]
  onContinue: () => void
  onStartFresh: () => void
}

function formatLastUpdated(date: Date | null): string {
  if (!date) return ''

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

export function SessionResumeDialog({
  transactionCount,
  lastUpdated,
  fileSources,
  onContinue,
  onStartFresh
}: SessionResumeDialogProps) {
  const [isClearing, setIsClearing] = useState(false)

  const handleStartFresh = async () => {
    setIsClearing(true)
    await onStartFresh()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Previous Session Found</h2>
        </div>

        <p className="text-gray-600 mb-4">
          You have <span className="font-semibold text-gray-900">{transactionCount} transaction{transactionCount !== 1 ? 's' : ''}</span> from a previous session saved in your browser.
          {lastUpdated && (
            <span className="block mt-1 text-sm text-gray-500">
              Last updated: {formatLastUpdated(lastUpdated)}
            </span>
          )}
        </p>

        {fileSources.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Imported files:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {fileSources.map((source, index) => (
                <li key={index} className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="truncate">{source}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-3 mb-6 text-sm text-gray-600">
          <p className="font-medium text-gray-700 mb-1">What does this mean?</p>
          <p>
            Your transaction data is stored locally in your browser. You can continue where you left off, or clear everything and start fresh.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onContinue}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-colors"
          >
            Continue Session
          </button>
          <button
            onClick={handleStartFresh}
            disabled={isClearing}
            className="flex-1 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium transition-colors disabled:opacity-50"
          >
            {isClearing ? 'Clearing...' : 'Start Fresh'}
          </button>
        </div>
      </div>
    </div>
  )
}
