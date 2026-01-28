import { useState } from 'react'
import { useIssues, Issue, IssueType } from '../hooks/useIssues'

/**
 * Icon components for different issue types
 */
function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  )
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  )
}

function ChevronIcon({ expanded, className }: { expanded: boolean; className?: string }) {
  return (
    <svg
      className={`${className} transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

/**
 * Get styling configuration based on issue type
 */
function getIssueStyles(type: IssueType) {
  switch (type) {
    case 'error':
      return {
        borderColor: 'border-l-red-500',
        bgColor: 'bg-red-50',
        iconColor: 'text-red-500',
        titleColor: 'text-red-800',
        textColor: 'text-red-700',
        badgeColor: 'bg-red-100 text-red-800',
        Icon: ErrorIcon,
      }
    case 'warning':
      return {
        borderColor: 'border-l-yellow-500',
        bgColor: 'bg-yellow-50',
        iconColor: 'text-yellow-500',
        titleColor: 'text-yellow-800',
        textColor: 'text-yellow-700',
        badgeColor: 'bg-yellow-100 text-yellow-800',
        Icon: WarningIcon,
      }
    case 'info':
      return {
        borderColor: 'border-l-blue-500',
        bgColor: 'bg-blue-50',
        iconColor: 'text-blue-500',
        titleColor: 'text-blue-800',
        textColor: 'text-blue-700',
        badgeColor: 'bg-blue-100 text-blue-800',
        Icon: InfoIcon,
      }
  }
}

/**
 * Single issue item component
 */
function IssueItem({ issue }: { issue: Issue }) {
  const styles = getIssueStyles(issue.type)

  return (
    <div className={`border-l-4 ${styles.borderColor} ${styles.bgColor} p-4 rounded-r-lg`}>
      <div className="flex items-start gap-3">
        <styles.Icon className={`h-5 w-5 ${styles.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`text-sm font-medium ${styles.titleColor}`}>
              {issue.title}
            </h4>
            {issue.count !== undefined && issue.count > 1 && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles.badgeColor}`}>
                {issue.count} affected
              </span>
            )}
          </div>

          <p className={`mt-1 text-sm ${styles.textColor}`}>
            {issue.description}
          </p>

          {issue.affectedItems && issue.affectedItems.length > 0 && (
            <div className="mt-2 flex items-center gap-1 flex-wrap">
              <span className={`text-xs ${styles.textColor}`}>Affected:</span>
              {issue.affectedItems.slice(0, 5).map((item) => (
                <span
                  key={item}
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono ${styles.badgeColor}`}
                >
                  {item}
                </span>
              ))}
              {issue.affectedItems.length > 5 && (
                <span className={`text-xs ${styles.textColor}`}>
                  +{issue.affectedItems.length - 5} more
                </span>
              )}
            </div>
          )}

          {issue.action && (
            <p className={`mt-2 text-sm ${styles.textColor}`}>
              <strong>Action:</strong> {issue.action}
            </p>
          )}

          <p className={`mt-2 text-xs ${styles.textColor} opacity-75`}>
            See the Transactions section below for details.
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Aggregated Issues Panel
 *
 * Displays all warnings, errors, and info messages in one centralized location.
 * Only renders when there are issues to display.
 */
export function IssuesPanel() {
  const issues = useIssues()

  // Determine default expanded state: expand by default if 3+ issues, collapse for 1-2
  const [isExpanded, setIsExpanded] = useState(() => issues.length >= 3)

  // Don't render if no issues
  if (issues.length === 0) {
    return null
  }

  // Count issues by type for the header summary
  const errorCount = issues.filter(i => i.type === 'error').length
  const warningCount = issues.filter(i => i.type === 'warning').length
  const infoCount = issues.filter(i => i.type === 'info').length

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* Header - always visible, clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                <ErrorIcon className="h-3.5 w-3.5" />
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                <WarningIcon className="h-3.5 w-3.5" />
                {warningCount}
              </span>
            )}
            {infoCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <InfoIcon className="h-3.5 w-3.5" />
                {infoCount}
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            {issues.length === 1 ? '1 Issue' : `${issues.length} Issues`} Requiring Attention
          </h2>
        </div>
        <ChevronIcon expanded={isExpanded} className="h-5 w-5 text-gray-400" />
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-3 border-t border-gray-100">
          <div className="pt-4 space-y-3">
            {issues.map((issue) => (
              <IssueItem key={issue.id} issue={issue} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
