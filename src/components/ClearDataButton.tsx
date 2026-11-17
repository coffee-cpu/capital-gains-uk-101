import { useRef, useState } from 'react'
import { clearAllData } from '../lib/db'

interface ClearDataButtonProps {
  /** What will be deleted, for the confirmation text */
  fileCount: number
  transactionCount: number
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n !== 1 ? 's' : ''}`
}

/**
 * Deletes every imported file, cached rate and setting, after a confirmation
 * dialog that says what goes. Lives in the import panel's files row.
 */
export function ClearDataButton({ fileCount, transactionCount }: ClearDataButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [isClearing, setIsClearing] = useState(false)

  const handleClear = async () => {
    setIsClearing(true)
    try {
      await clearAllData()
    } catch (err) {
      console.error('Failed to clear data:', err)
      setIsClearing(false)
    }
  }

  const what = [
    fileCount > 0 && plural(fileCount, 'file'),
    transactionCount > 0 && plural(transactionCount, 'transaction'),
  ].filter(Boolean).join(' and ')

  return (
    <>
      <button
        type="button"
        onClick={() => {
          dialogRef.current?.showModal()
          // Start on the safe choice (showModal would focus Delete, the first button)
          cancelRef.current?.focus()
        }}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 -mr-2 text-sm font-medium text-red-700 hover:bg-red-50 hover:text-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
          />
        </svg>
        Clear all data
      </button>

      {/* Native modal: Escape closes it, focus stays inside, the page behind is inert */}
      <dialog
        ref={dialogRef}
        aria-labelledby="clear-data-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-6 shadow-xl backdrop:bg-gray-900/40"
        onClick={(e) => { if (e.target === dialogRef.current && !isClearing) dialogRef.current.close() }}
        onCancel={(e) => { if (isClearing) e.preventDefault() }}
      >
        <h2 id="clear-data-title" className="text-lg font-semibold text-gray-900">Clear all data?</h2>
        <p className="mt-2 text-sm text-gray-600">
          {what ? `This removes ${what} from this browser` : 'This removes your imported data from this browser'},
          along with cached exchange rates and your settings. It can&apos;t be undone.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleClear}
            disabled={isClearing}
            className="w-full sm:w-auto rounded-md bg-red-600 px-4 py-2.5 sm:py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {isClearing ? 'Clearing…' : 'Delete everything'}
          </button>
          <button
            type="button"
            ref={cancelRef}
            onClick={() => dialogRef.current?.close()}
            disabled={isClearing}
            className="w-full sm:w-auto rounded-md border border-gray-300 bg-white px-4 py-2.5 sm:py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </dialog>
    </>
  )
}
