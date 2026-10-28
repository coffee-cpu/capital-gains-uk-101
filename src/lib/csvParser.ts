import Papa from 'papaparse'
import { RawCSVRow } from '../types/broker'
import { CSVPreprocessor } from './parsers/fileUtils'
import { ibCSVPreprocessor } from './parsers/interactiveBrokers'
import { coinbaseCSVPreprocessor } from './parsers/coinbase'

/**
 * Registered raw-file preprocessors, checked in order. First match wins.
 * New broker preprocessors are added by exporting a `CSVPreprocessor`
 * from the parser module and appending it here.
 */
const PREPROCESSORS: readonly CSVPreprocessor[] = [
  ibCSVPreprocessor,
  coinbaseCSVPreprocessor,
]

/**
 * Parse CSV text into raw rows
 */
export function parseCSVText(text: string): RawCSVRow[] {
  const results = Papa.parse<RawCSVRow>(text, {
    header: true,
    skipEmptyLines: true,
  })
  if (results.errors.length > 0) {
    throw new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`)
  }
  return results.data
}

/**
 * Dispatch raw-file preprocessing to the first registered preprocessor that matches.
 * Returns the original text unchanged if none apply.
 */
export function preprocessCSVText(text: string): string {
  for (const preprocessor of PREPROCESSORS) {
    if (preprocessor.matches(text)) {
      return preprocessor.apply(text)
    }
  }
  return text
}
