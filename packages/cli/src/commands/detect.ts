import { describeSkippedRows, importCSVText, MIN_DETECTION_CONFIDENCE } from '../../../../src/lib/import'
import { SkippedRow } from '../../../../src/types/brokerDefinition'
import { parseCSVText, preprocessCSVText } from '../../../../src/lib/csvParser'
import { detectBroker } from '../../../../src/lib/brokerDetector'
import { BrokerType } from '../../../../src/types/broker'
import { InputFile } from '../inputs'

export interface DetectResult {
  file: string
  recognised: boolean
  broker: BrokerType
  confidence: number
  transactions: number
  /** Data rows the parser couldn't read and left out */
  skippedRows: SkippedRow[]
  error?: string
}

/** Identify each file's broker format without calculating anything */
export function detect(files: InputFile[]): DetectResult[] {
  return files.map(file => {
    try {
      const imported = importCSVText(file.text, file.fileId)
      return {
        file: file.path,
        recognised: true,
        broker: imported.broker,
        confidence: imported.confidence,
        transactions: imported.transactions.length,
        skippedRows: imported.skippedRows,
      }
    } catch (error) {
      return {
        file: file.path,
        recognised: false,
        ...bestGuess(file.text),
        transactions: 0,
        skippedRows: [],
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })
}

/** Detection result for a file that failed to import, for diagnostics */
function bestGuess(text: string): { broker: BrokerType; confidence: number } {
  try {
    const detection = detectBroker(parseCSVText(preprocessCSVText(text)))
    return detection.confidence >= MIN_DETECTION_CONFIDENCE
      ? { broker: detection.broker, confidence: detection.confidence }
      : { broker: BrokerType.UNKNOWN, confidence: detection.confidence }
  } catch {
    return { broker: BrokerType.UNKNOWN, confidence: 0 }
  }
}

export function formatDetectText(results: DetectResult[]): string {
  return results.map(r =>
    r.recognised
      ? `${r.file}: ${r.broker} (${r.transactions} transactions)` +
        (r.skippedRows.length > 0 ? `; ${r.skippedRows.length} row(s) skipped: ${describeSkippedRows(r.skippedRows, 5)}` : '')
      : `${r.file}: not recognised — ${r.error}`
  ).join('\n') + '\n'
}
