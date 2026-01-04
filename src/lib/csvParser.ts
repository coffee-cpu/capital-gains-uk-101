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
 * Check if a file is a Coinbase CSV by reading the first few lines
 * Coinbase CSVs have a distinctive structure:
 * - Optional blank line(s) at the start
 * - "Transactions" row (may have trailing commas)
 * - "User,<name>,<uuid>,..." row
 */
export async function isCoinbaseCSV(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) {
        resolve(false)
        return
      }
      // Split into lines and find the first non-empty lines
      const lines = text.split('\n')

      // Find "Transactions" line and "User" line (skipping empty lines)
      let foundTransactions = false
      let foundUser = false

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine) continue // Skip empty lines

        if (!foundTransactions) {
          if (trimmedLine.startsWith('Transactions')) {
            foundTransactions = true
          } else {
            // First non-empty line is not "Transactions"
            resolve(false)
            return
          }
        } else if (!foundUser) {
          if (trimmedLine.startsWith('User')) {
            foundUser = true
            break
          } else {
            // Second non-empty line is not "User"
            resolve(false)
            return
          }
        }
      }

      resolve(foundTransactions && foundUser)
    }
    reader.onerror = () => resolve(false)
    // Read first 500 bytes to check the headers (enough for metadata lines)
    reader.readAsText(file.slice(0, 500))
  })
}

/**
 * Strip the metadata rows from a Coinbase CSV file and return a new File
 * Coinbase CSVs have:
 * - Optional blank line(s) at the start
 * - "Transactions" row
 * - "User,<name>,<uuid>,..." row
 * - Actual headers row
 * - Data rows
 *
 * We need to remove everything before the actual headers row (which starts with "ID")
 */
export async function stripCoinbaseMetadataRows(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) {
        reject(new Error('Failed to read file'))
        return
      }

      // Split by lines and find where the actual headers start
      const lines = text.split('\n')

      // Find the index of the header row (starts with "ID")
      let headerRowIndex = -1
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const trimmedLine = lines[i].trim()
        if (trimmedLine.startsWith('ID,') || trimmedLine.startsWith('ID\t')) {
          headerRowIndex = i
          break
        }
      }

      if (headerRowIndex === -1) {
        reject(new Error('Could not find Coinbase CSV headers'))
        return
      }

      // Rejoin from the header row onwards
      const csvWithoutMetadata = lines.slice(headerRowIndex).join('\n')

      // Create a new File object with the stripped content
      const strippedFile = new File([csvWithoutMetadata], file.name, { type: file.type })
      resolve(strippedFile)
    }
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    reader.readAsText(file)
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
