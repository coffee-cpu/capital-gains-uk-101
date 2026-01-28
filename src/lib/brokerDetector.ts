import { BrokerType, BrokerDetectionResult, RawCSVRow } from '../types/broker'
import { BrokerDefinition } from '../types/brokerDefinition'
import { getBrokerDefinitionsSortedByPriority } from '../config/brokers'

/**
 * Detect broker using header matching
 * Returns confidence based on percentage of headers matched
 */
function detectByHeaders(headers: string[], definition: BrokerDefinition): BrokerDetectionResult {
  const requiredHeaders = definition.detection.requiredHeaders
  if (requiredHeaders.length === 0) {
    return {
      broker: definition.type,
      confidence: 0,
      headerMatches: [],
    }
  }

  const matches = requiredHeaders.filter(h => headers.includes(h))
  return {
    broker: definition.type,
    confidence: matches.length / requiredHeaders.length,
    headerMatches: matches,
  }
}

/**
 * Detect broker from CSV headers and data patterns
 * Uses the central broker registry for detection configuration
 */
export function detectBroker(rows: RawCSVRow[]): BrokerDetectionResult {
  if (rows.length === 0) {
    return { broker: BrokerType.UNKNOWN, confidence: 0, headerMatches: [] }
  }

  const headers = Object.keys(rows[0])
  const definitions = getBrokerDefinitionsSortedByPriority()

  const results: BrokerDetectionResult[] = []

  for (const definition of definitions) {
    let result: BrokerDetectionResult

    // Use custom detector if available, otherwise use header matching
    if (definition.detection.customDetector) {
      result = definition.detection.customDetector(headers, rows)
    } else {
      result = detectByHeaders(headers, definition)
    }

    // Return immediately if high confidence match found
    if (result.confidence > 0.8) {
      return result
    }

    results.push(result)
  }

  // Return best match or unknown
  const bestMatch = results.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  )

  return bestMatch.confidence > 0
    ? bestMatch
    : { broker: BrokerType.UNKNOWN, confidence: 0, headerMatches: [] }
}
