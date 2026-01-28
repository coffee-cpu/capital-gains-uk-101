import { useState } from 'react'
import { getEnabledBrokerDefinitions } from '../config/brokers'
import { BrokerInstructions } from './BrokerInstructions'

/**
 * Renders the list of supported broker formats with expandable instructions
 * Data-driven component that uses the broker registry
 */
export function BrokerFormatsList() {
  const [showFormats, setShowFormats] = useState(false)
  const [expandedFormat, setExpandedFormat] = useState<string | null>(null)

  const brokerDefinitions = getEnabledBrokerDefinitions()

  const handleToggle = (shortId: string) => {
    setExpandedFormat(expandedFormat === shortId ? null : shortId)
  }

  return (
    <div className="text-sm text-gray-500">
      <button
        onClick={() => setShowFormats(!showFormats)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-2"
      >
        <svg
          className={`w-4 h-4 transition-transform ${showFormats ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>Supported formats & export guides ({brokerDefinitions.length})</span>
      </button>
      {showFormats && (
        <ul className="space-y-2 ml-6">
          {brokerDefinitions.map((definition) => (
            <BrokerInstructions
              key={definition.shortId}
              definition={definition}
              isExpanded={expandedFormat === definition.shortId}
              onToggle={() => handleToggle(definition.shortId)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
