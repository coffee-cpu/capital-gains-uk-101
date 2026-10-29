import { preprocessCSVText, parseCSVText } from './csvParser'
import { detectBroker } from './brokerDetector'
import { getParser } from './parsers/parserRegistry'
import { normalizeTransactionSymbols } from '../utils/symbolNormalization'
import { BrokerType } from '../types/broker'
import { GenericTransaction } from '../types/transaction'
import { SkippedRow } from '../types/brokerDefinition'

/** Minimum detection confidence required to accept a file's broker format */
export const MIN_DETECTION_CONFIDENCE = 0.8

export interface CSVImportResult {
  broker: BrokerType
  confidence: number
  transactions: GenericTransaction[]
  /** Rows the parser couldn't interpret and dropped (reported by the Generic CSV parser) */
  skippedRows: SkippedRow[]
}

/** Short description of skipped rows for messages, e.g. 'row 3: unrecognised type "SEL"' */
export function describeSkippedRows(skippedRows: SkippedRow[], limit = 3): string {
  const shown = skippedRows.slice(0, limit).map(s => `row ${s.row}: ${s.reason}`)
  const more = skippedRows.length > limit ? `, and ${skippedRows.length - limit} more` : ''
  return shown.join('; ') + more
}

/**
 * Build the file identifier used as the transaction ID prefix.
 * Format: sanitised file name + byte size (e.g. 'my_transactions_csv-12345').
 */
export function createFileId(fileName: string, sizeInBytes: number): string {
  return `${fileName.replace(/[^a-z0-9]/gi, '_')}-${sizeInBytes}`
}

/**
 * Turn the raw text of a broker export into GenericTransactions.
 *
 * Runs the whole import step: preprocessing (multi-section and metadata
 * formats), CSV parsing, broker detection, the broker's parser and symbol
 * normalisation. Pure and runtime-agnostic — persistence and duplicate-file
 * checks are left to the caller.
 *
 * @throws Error if the format can't be detected or no transactions are found
 */
export function importCSVText(text: string, fileId: string): CSVImportResult {
  // FileReader strips a UTF-8 BOM in the browser; Node's fs does not
  const content = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const rawRows = parseCSVText(preprocessCSVText(content))

  const detection = detectBroker(rawRows)
  if (detection.confidence < MIN_DETECTION_CONFIDENCE) {
    throw new Error(`Could not detect CSV format (confidence: ${(detection.confidence * 100).toFixed(0)}%). Please check your CSV file format.`)
  }

  const parser = getParser(detection.broker)
  if (!parser) {
    throw new Error(`Unsupported broker: ${detection.broker}`)
  }

  const skippedRows: SkippedRow[] = []
  const transactions = parser(rawRows, fileId, skippedRows)
  if (transactions.length === 0) {
    const detail = skippedRows.length > 0 ? ` (${describeSkippedRows(skippedRows)})` : ''
    throw new Error(`No valid transactions found in CSV${detail}`)
  }

  return {
    broker: detection.broker,
    confidence: detection.confidence,
    // Apply symbol normalization (e.g., FB -> META)
    transactions: normalizeTransactionSymbols(transactions),
    skippedRows,
  }
}
