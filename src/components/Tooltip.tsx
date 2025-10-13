import { ReactNode } from 'react'

interface TooltipProps {
  content: string
  children: ReactNode
  className?: string
}

/**
 * Custom tooltip component with fast display and better styling.
 * Shows on hover with minimal delay (150ms vs browser default ~1s).
 */
export function Tooltip({ content, children, className = '' }: TooltipProps) {
  return (
    <div className={`relative inline-block group ${className}`}>
      {children}
      <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-150 absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
        {content}
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
          <div className="border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    </div>
  )
}
