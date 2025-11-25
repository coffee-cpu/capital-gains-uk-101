import Dexie, { Table } from 'dexie'
import { GenericTransaction } from '../types/transaction'

/**
 * FX Rate cache entry
 */
export interface FXRate {
  id: string // Composite key: date-currency (e.g., '2025-05-15-USD')
  date: string // YYYY-MM-DD
  currency: string // e.g. 'USD'
  rate: number // GBP conversion rate
  source: string // e.g. 'Bank of England'
}

/**
 * Imported file metadata
 */
export interface ImportedFile {
  fileId: string // Composite key: filename-filesize (e.g., 'my_transactions_csv-12345')
  filename: string // Original filename (e.g., 'my-transactions.csv')
  broker: string // Detected broker type (e.g., 'Charles Schwab')
  transactionCount: number // Number of transactions imported from this file
  importedAt: string // ISO timestamp when file was imported
}

/**
 * IndexedDB database for local storage
 */
export class CGTDatabase extends Dexie {
  transactions!: Table<GenericTransaction, string>
  fx_rates!: Table<FXRate, string>
  imported_files!: Table<ImportedFile, string>

  constructor() {
    super('cgt-visualizer')

    this.version(1).stores({
      transactions: 'id, source, symbol, date, type',
      fx_rates: '[date+currency], date, currency',
    })

    // Version 2: Add imported_files table
    this.version(2).stores({
      transactions: 'id, source, symbol, date, type',
      fx_rates: '[date+currency], date, currency',
      imported_files: 'fileId, filename, importedAt',
    })
  }
}

export const db = new CGTDatabase()
