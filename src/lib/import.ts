import { preprocessCSVText, parseCSVText } from './csvParser'
import { detectBroker } from './brokerDetector'
import { getParser } from './parsers/parserRegistry'
import { normalizeTransactionSymbols } from '../utils/symbolNormalization'
import { BrokerType } from '../types/broker'
import { GenericTransaction } from '../types/transaction'

/** Minimum detection confidence required to accept a file's broker format */
export const MIN_DETECTION_CONFIDENCE = 0.8

export interface CSVImportResult {
  broker: BrokerType
  confidence: number
  transactions: GenericTransaction[]
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

  const transactions = parser(rawRows, fileId)
  if (transactions.length === 0) {
    throw new Error('No valid transactions found in CSV')
  }

  return {
    broker: detection.broker,
    confidence: detection.confidence,
    // Apply symbol normalization (e.g., FB -> META)
    transactions: normalizeTransactionSymbols(transactions),
  }
}
