/**
 * Unified Broker Definition Interface
 *
 * Single source of truth for all broker metadata including:
 * - Detection configuration (headers, priority)
 * - Parser function
 * - UI instructions
 * - Help links
 * - Example files
 */

import { BrokerType, RawCSVRow, BrokerDetectionResult } from './broker'
import { GenericTransaction } from './transaction'

/**
 * Parser function signature
 * @param rows Raw CSV rows from the file
 * @param fileId Unique identifier for the file (used for transaction IDs)
 */
export type ParserFunction = (
  rows: RawCSVRow[],
  fileId: string
) => GenericTransaction[]

/**
 * UI instructions for downloading CSV from a broker
 */
export interface BrokerUIInstructions {
  /** Step-by-step instructions for downloading the CSV */
  steps: string[]
  /** Additional notes/tips */
  notes?: string[]
  /** Info callout (blue) - for helpful tips */
  info?: string
  /** Warning callout (amber) - for important caveats */
  warning?: string
}

/**
 * Help link for broker documentation
 */
export interface BrokerHelpLink {
  /** Display label for the link */
  label: string
  /** URL to the help page */
  url: string
}

/**
 * Custom detection function signature
 * Used for brokers that need more than simple header matching
 */
export type CustomDetectorFunction = (
  headers: string[],
  rows: RawCSVRow[]
) => BrokerDetectionResult

/**
 * Configuration for broker detection
 */
export interface BrokerDetectionConfig {
  /** Headers that must be present for detection */
  requiredHeaders: string[]
  /** Lower number = checked first (for overlapping headers). Default: 50 */
  priority?: number
  /** Custom detection function for complex detection logic */
  customDetector?: CustomDetectorFunction
}

/**
 * Complete broker definition - single source of truth
 */
export interface BrokerDefinition {
  /** Broker type enum value */
  type: BrokerType
  /** Display name shown to users */
  displayName: string
  /** Short ID for UI state keys (e.g., 'schwab', 'ibkr') */
  shortId: string
  /** Detection configuration */
  detection: BrokerDetectionConfig
  /** Parser function to convert CSV rows to transactions */
  parser: ParserFunction
  /** UI instructions for downloading CSV */
  instructions: BrokerUIInstructions
  /** Path to example CSV file in /examples/ */
  exampleFile: string
  /** Optional help links for official documentation */
  helpLinks?: BrokerHelpLink[]
  /** Whether this broker is enabled (default: true) */
  enabled?: boolean
}
