import Papa from 'papaparse'
import { RawCSVRow } from '../types/broker'

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
