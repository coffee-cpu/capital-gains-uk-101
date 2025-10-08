/**
 * Broker types and detection
 */

export enum BrokerType {
  SCHWAB = 'Charles Schwab',
  TRADING212 = 'Trading 212',
  GENERIC = 'Generic CSV',
  UNKNOWN = 'Unknown',
}

/**
 * Raw CSV row - any key-value pairs from parsed CSV
 */
export type RawCSVRow = Record<string, string>

/**
 * Broker detection result
 */
export interface BrokerDetectionResult {
  broker: BrokerType
  confidence: number // 0-1
  headerMatches: string[]
}
