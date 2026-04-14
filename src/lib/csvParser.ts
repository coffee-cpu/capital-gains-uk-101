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
 * Parse CSV file into raw rows
 */
export async function parseCSV(file: File): Promise<RawCSVRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawCSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`))
        } else {
          resolve(results.data)
        }
      },
      error: (error) => {
        reject(error)
      },
    })
  })
}

/**
 * Dispatch raw-file preprocessing to the first registered preprocessor that matches.
 * Returns the original file unchanged if none apply.
 */
export async function preprocessCSVFile(file: File): Promise<File> {
  for (const preprocessor of PREPROCESSORS) {
    if (await preprocessor.matches(file)) {
      return preprocessor.apply(file)
    }
  }
  return file
}

/**
 * Parse CSV from text content
 */
export function parseCSVText(text: string): RawCSVRow[] {
  const result = Papa.parse<RawCSVRow>(text, {
    header: true,
    skipEmptyLines: true,
  })

  if (result.errors.length > 0) {
    throw new Error(`CSV parsing errors: ${result.errors.map(e => e.message).join(', ')}`)
  }

  return result.data
}
