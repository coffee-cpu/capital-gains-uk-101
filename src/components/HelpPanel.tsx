import { useState, useEffect, useRef } from 'react'
import { useTransactionStore } from '../stores/transactionStore'
import { getHelpContent, HelpContext } from '../utils/helpContent'

type TabType = 'explanation' | 'example' | 'references'

export function HelpPanel() {
  const isOpen = useTransactionStore((state) => state.isHelpPanelOpen)
  const context = useTransactionStore((state) => state.helpContext)
  const setHelpPanelOpen = useTransactionStore((state) => state.setHelpPanelOpen)
  const [activeTab, setActiveTab] = useState<TabType>('explanation')
  const panelRef = useRef<HTMLElement>(null)

  const content = getHelpContent(context)

  // Reset to explanation tab when context changes
  useEffect(() => {
    setActiveTab('explanation')
  }, [context])

  // Handle Escape key to close panel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setHelpPanelOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, setHelpPanelOpen])

  // Handle click outside to close panel
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setHelpPanelOpen(false)
      }
    }

    // Add listener with a small delay to avoid closing immediately after opening
    if (isOpen) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 100)

      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen, setHelpPanelOpen])

  // Hide on mobile/tablet - desktop only (lg breakpoint = 1024px+)
  if (!isOpen) {
    return null
  }

  return (
    <>
      {/* Help Panel - Desktop Only Overlay */}
      <aside
        ref={panelRef}
        className={`
          hidden lg:block
          fixed top-0 right-0
          w-96
          h-screen
          bg-white
          border-l border-gray-200
          shadow-2xl
          overflow-y-auto
          z-40
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="complementary"
        aria-label="Help panel"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {content.title}
              </h3>
              {content.hmrcReference && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {content.hmrcReference}
                </p>
              )}
            </div>
            <button
              onClick={() => setHelpPanelOpen(false)}
              className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close help panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-1 mt-3 -mb-px" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'explanation'}
              onClick={() => setActiveTab('explanation')}
              className={`
                px-3 py-2 text-sm font-medium rounded-t-md transition-colors
                ${activeTab === 'explanation'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              Explanation
            </button>
            {content.example && (
              <button
                role="tab"
                aria-selected={activeTab === 'example'}
                onClick={() => setActiveTab('example')}
                className={`
                  px-3 py-2 text-sm font-medium rounded-t-md transition-colors
                  ${activeTab === 'example'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                Example
              </button>
            )}
            <button
              role="tab"
              aria-selected={activeTab === 'references'}
              onClick={() => setActiveTab('references')}
              className={`
                px-3 py-2 text-sm font-medium rounded-t-md transition-colors
                ${activeTab === 'references'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              References
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-4 pb-20">
          {/* Explanation Tab */}
          {activeTab === 'explanation' && (
            <div className="prose prose-sm max-w-none">
              <div className="text-gray-700 leading-relaxed space-y-3">
                {formatExplanationText(content.explanation)}
              </div>
            </div>
          )}

          {/* Example Tab */}
          {activeTab === 'example' && content.example && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  {content.example.title}
                </h4>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {content.example.scenario}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h5 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                  Calculation
                </h5>
                <div className="font-mono text-xs text-gray-800 space-y-0.5">
                  {content.example.calculation.map((line, idx) => (
                    <div key={idx} className={line === '' ? 'h-2' : ''}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`
                border-l-4 pl-4 py-2
                ${getResultBorderColor(context)}
              `}>
                <p className="text-sm font-medium text-gray-900">
                  {content.example.result}
                </p>
              </div>
            </div>
          )}

          {/* References Tab */}
          {activeTab === 'references' && (
            <div className="space-y-3">
              {content.references.map((ref, idx) => (
                <a
                  key={idx}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-blue-600 group-hover:text-blue-700 mb-1">
                        {ref.title}
                      </h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {ref.description}
                      </p>
                    </div>
                    <svg
                      className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

/**
 * Format explanation text with markdown-style formatting
 * Converts **bold** to <strong>, - lists to bullets, etc.
 */
function formatExplanationText(text: string): JSX.Element[] {
  const paragraphs = text.split('\n\n')

  return paragraphs.map((paragraph, pIdx) => {
    // Check if it's a list item
    if (paragraph.trim().startsWith('-')) {
      const items = paragraph.split('\n').filter(line => line.trim().startsWith('-'))
      return (
        <ul key={pIdx} className="list-disc pl-5 space-y-1">
          {items.map((item, iIdx) => (
            <li key={iIdx}>{formatInlineText(item.replace(/^-\s*/, ''))}</li>
          ))}
        </ul>
      )
    }

    // Check if it's a numbered list
    if (/^\d+\./.test(paragraph.trim())) {
      const items = paragraph.split('\n').filter(line => /^\d+\./.test(line.trim()))
      return (
        <ol key={pIdx} className="list-decimal pl-5 space-y-1">
          {items.map((item, iIdx) => (
            <li key={iIdx}>{formatInlineText(item.replace(/^\d+\.\s*/, ''))}</li>
          ))}
        </ol>
      )
    }

    // Regular paragraph
    return <p key={pIdx}>{formatInlineText(paragraph)}</p>
  })
}

/**
 * Format inline text with bold (**text**)
 */
function formatInlineText(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0

  // Match **bold text**
  const boldRegex = /\*\*(.+?)\*\*/g
  let match

  while ((match = boldRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    // Add bold text
    parts.push(<strong key={match.index}>{match[1]}</strong>)
    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

/**
 * Get border color for result box based on context
 */
function getResultBorderColor(context: HelpContext): string {
  switch (context) {
    case 'same-day':
      return 'border-blue-400'
    case '30-day':
      return 'border-orange-400'
    case 'section104':
      return 'border-green-400'
    case 'stock-split':
      return 'border-purple-400'
    default:
      return 'border-gray-400'
  }
}
