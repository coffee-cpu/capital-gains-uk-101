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
 * Check if a file is an Interactive Brokers CSV
 * IB CSVs have a distinctive multi-section format with:
 * - "Statement" section at the start
 * - "Transaction History" section with the actual trades
 */
export async function isInteractiveBrokersCSV(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) {
        resolve(false)
        return
      }
      // Check for IB-specific patterns
      const hasStatement = text.includes('Statement,Header,') || text.includes('Statement,Data,')
      const hasTransactionHistory = text.includes('Transaction History,Header,') || text.includes('Transaction History,Data,')

      resolve(hasStatement && hasTransactionHistory)
    }
    reader.onerror = () => resolve(false)
    reader.readAsText(file.slice(0, 2000)) // Read first 2KB to check the structure
  })
}

/**
 * Preprocess Interactive Brokers CSV to handle its multi-section format
 *
 * IB CSVs have multiple sections with different column counts:
 * - Statement: 4 columns (Statement,Header/Data,Field Name,Field Value)
 * - Summary: 4 columns (Summary,Header/Data,Field Name,Field Value)
 * - Transaction History: 11+ columns
 *
 * We need to extract each section's header and apply it to that section's data rows
 */
export async function preprocessInteractiveBrokersCSV(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) {
        reject(new Error('Failed to read file'))
        return
      }

      const lines = text.split('\n')
      let headerRow: string | null = null
      const summaryRows: string[] = []
      const transactionRows: string[] = []

      for (const line of lines) {
        if (!line.trim()) continue

        // Parse the line to extract section name and row type
        // Use a simple regex since we just need the first two columns
        const match = line.match(/^([^,]+),([^,]+),(.*)$/)
        if (!match) {
          continue
        }

        const sectionName = match[1]
        const rowType = match[2]
        const restOfLine = match[3]

        if (rowType === 'Header') {
          // Store the header for Transaction History section
          if (sectionName === 'Transaction History') {
            // Create header row with Section and RowType columns prepended
            headerRow = `Section,RowType,${restOfLine}`
          }
        } else if (rowType === 'Data') {
          // Collect data rows for Transaction History section
          if (sectionName === 'Transaction History') {
            transactionRows.push(`${sectionName},${rowType},${restOfLine}`)
          } else if (sectionName === 'Summary') {
            // Also include Summary section for base currency extraction
            // Pad with empty columns to match Transaction History column count
            summaryRows.push(`${sectionName},${rowType},${restOfLine},,,,,,,,`)
          }
        }
      }

      if (!headerRow) {
        reject(new Error('Could not find Transaction History header in Interactive Brokers CSV'))
        return
      }

      // Build the final CSV with header FIRST, then Summary rows, then Transaction History rows
      const processedRows = [headerRow, ...summaryRows, ...transactionRows]

      if (processedRows.length <= 1) {
        reject(new Error('Could not find Transaction History data in Interactive Brokers CSV'))
        return
      }

      const processedCsv = processedRows.join('\n')
      const processedFile = new File([processedCsv], file.name, { type: file.type })
      resolve(processedFile)
    }
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    reader.readAsText(file)
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
