import Dexie, { Table } from 'dexie'
import { GenericTransaction } from '../types/transaction'
import { FXStrategy } from '../types/fxStrategy'

/**
 * FX Rate cache entry
 */
export interface FXRate {
  id: string // Composite key: strategy-date-currency (e.g., 'HMRC_MONTHLY-2025-05-USD')
  date: string // Date key (format varies by strategy: YYYY-MM, YYYY, or YYYY-MM-DD)
  currency: string // e.g. 'USD'
  rate: number // GBP conversion rate
  source: string // e.g. 'HMRC Monthly Exchange Rates'
  strategy?: FXStrategy // Which strategy this rate belongs to (optional for backward compat)
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
 * User settings
 */
export interface UserSetting {
  key: string // Setting key (e.g., 'fxStrategy')
  value: string // JSON-encoded value
  updatedAt: string // ISO timestamp
}

/**
 * IndexedDB database for local storage
 */
export class CGTDatabase extends Dexie {
  transactions!: Table<GenericTransaction, string>
  fx_rates!: Table<FXRate, string>
  imported_files!: Table<ImportedFile, string>
  settings!: Table<UserSetting, string>

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

    // Version 3: Add settings table and update fx_rates with strategy field
    // fx_rates now uses 'id' as primary key (format: STRATEGY-date-currency)
    // This allows storing rates from multiple strategies
    this.version(3).stores({
      transactions: 'id, source, symbol, date, type',
      fx_rates: 'id, date, currency, strategy',
      imported_files: 'fileId, filename, importedAt',
      settings: 'key',
    })
  }
}

export const db = new CGTDatabase()
