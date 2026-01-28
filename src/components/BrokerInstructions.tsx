import { BrokerDefinition } from '../types/brokerDefinition'

interface BrokerInstructionsProps {
  definition: BrokerDefinition
  isExpanded: boolean
  onToggle: () => void
}

/**
 * Renders instructions for a single broker
 * Data-driven component that uses BrokerDefinition for all content
 */
export function BrokerInstructions({ definition, isExpanded, onToggle }: BrokerInstructionsProps) {
  const { displayName, shortId, instructions, exampleFile, helpLinks } = definition
  const hasSteps = instructions.steps.length > 0
  const hasNotes = instructions.notes && instructions.notes.length > 0

  // For generic CSV, show "format & example" instead of "instructions & example"
  const buttonLabel = shortId === 'generic'
    ? (isExpanded ? 'hide' : 'format & example')
    : (isExpanded ? 'hide' : 'instructions & example')

  return (
    <li>
      <div className="flex justify-between items-center md:justify-start md:gap-4">
        <span>{displayName}</span>
        <button
          onClick={onToggle}
          className="text-blue-600 hover:text-blue-800 text-xs underline whitespace-nowrap"
        >
          {buttonLabel}
        </button>
      </div>
      {isExpanded && (
        <div className="mt-2 ml-4 p-3 bg-gray-50 rounded text-xs space-y-2">
          {/* Step-by-step instructions */}
          {hasSteps && (
            <>
              <p className="font-medium">How to download:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-600">
                {instructions.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </>
          )}

          {/* Notes */}
          {hasNotes && instructions.notes!.map((note, index) => (
            <p key={index} className="text-gray-600 italic">
              {hasSteps ? `Note: ${note}` : note}
            </p>
          ))}

          {/* Info callout (blue) */}
          {instructions.info && (
            <p className="text-blue-700 font-medium bg-blue-50 border border-blue-200 rounded p-2">
              {instructions.info}
            </p>
          )}

          {/* Warning callout (amber) */}
          {instructions.warning && (
            <p className="text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded p-2">
              {instructions.warning}
            </p>
          )}

          {/* Help links and example file */}
          <div className="flex flex-wrap gap-4">
            {helpLinks?.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-blue-600 hover:text-blue-800 underline"
              >
                {link.label}
              </a>
            ))}
            <a
              href={exampleFile}
              className="inline-block text-blue-600 hover:text-blue-800 underline"
            >
              Download example file
            </a>
          </div>
        </div>
      )}
    </li>
  )
}
