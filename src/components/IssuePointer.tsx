import type { ReactNode } from 'react'

/**
 * A one-line warning shown next to what an issue affects, pointing to its
 * full explanation and advice in the Issues panel at the top of the page.
 */
export function IssuePointer({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
      role="note"
      data-testid={testId}
    >
      <svg className="h-4 w-4 flex-shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
      <p>{children}</p>
    </div>
  )
}
