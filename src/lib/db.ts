import Dexie, { Table } from 'dexie'
import { GenericTransaction } from '../types/transaction'
import { FXSource } from '../types/fxSource'

/**
 * FX Rate cache entry
 */
export interface FXRate {
  id: string // Composite key: source-date-currency (e.g., 'HMRC_MONTHLY-2025-05-USD')
  date: string // Date key (format varies by source: YYYY-MM, YYYY, or YYYY-MM-DD)
  currency: string // e.g. 'USD'
  rate: number // GBP conversion rate
  source: string // e.g. 'HMRC Monthly Exchange Rates'
  fxSource?: FXSource // Which FX source this rate belongs to (optional for backward compat)
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

    // Version 3: Add settings table and update fx_rates with fxSource field
    // fx_rates now uses 'id' as primary key (format: SOURCE-date-currency)
    // This allows storing rates from multiple sources
    this.version(3).stores({
      transactions: 'id, source, symbol, date, type',
      fx_rates: 'id, date, currency, fxSource',
      imported_files: 'fileId, filename, importedAt',
      settings: 'key',
    })
  }
}

export const db = new CGTDatabase()

/**
 * Ensure the database can be opened and upgraded successfully.
 * If the database has an incompatible schema, automatically clears it.
 *
 * This handles scenarios where:
 * - Database exists with incompatible schema (e.g., changed primary key)
 * - Upgrade errors that Dexie cannot handle automatically
 */
export async function ensureDatabaseCompatible(): Promise<void> {
  try {
    // Try to open the database - this triggers any pending upgrades
    await db.open()

    // Try a simple operation to verify it's working
    await db.transactions.count()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Check for upgrade errors that require a database reset
    const needsReset = errorMessage.includes('UpgradeError') ||
                       errorMessage.includes('changing primary key') ||
                       errorMessage.includes('DatabaseClosedError')

    if (needsReset) {
      console.warn('Database schema incompatible, clearing and recreating:', errorMessage)
      // Delete the incompatible database
      await db.delete()
      // Reopen with fresh schema
      await db.open()
    } else {
      // Re-throw unexpected errors
      throw error
    }
  }
}

/**
 * Clears all application data (database + localStorage) and reloads the page.
 * Use this for "Start Fresh" or "Clear All Data" functionality.
 */
export async function clearAllData(): Promise<void> {
  // Delete entire IndexedDB database (handles schema migration issues)
  await db.delete()

  // Clear localStorage (Zustand persist)
  localStorage.removeItem('cgt-settings')

  // Reload page to ensure clean state
  window.location.reload()
}
