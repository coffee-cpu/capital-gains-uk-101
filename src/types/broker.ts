/**
 * Broker types and detection
 */

export enum BrokerType {
  SCHWAB = 'Charles Schwab',
  SCHWAB_EQUITY_AWARDS = 'Charles Schwab Equity Awards',
  TRADING212 = 'Trading 212',
  FREETRADE = 'Freetrade',
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
