import Dexie, { Table } from 'dexie'
import { GenericTransaction } from '../types/transaction'
import { FXRate, CachedSplitYear, setCacheBackends } from './cache'

export type { FXRate, CachedSplitYear }

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
  split_data_cache!: Table<CachedSplitYear, number>

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

    // Version 4: Add split_data_cache table for auto-fetched stock split data
    this.version(4).stores({
      transactions: 'id, source, symbol, date, type',
      fx_rates: 'id, date, currency, fxSource',
      imported_files: 'fileId, filename, importedAt',
      settings: 'key',
      split_data_cache: 'year',
    })
  }
}

export const db = new CGTDatabase()

/**
 * Persist fetched FX rates and stock split data in IndexedDB.
 * Called once at app startup; without it, core code falls back to in-memory caches.
 */
export function registerIndexedDBCaches(): void {
  setCacheBackends({
    fxRates: db.fx_rates,
    splitData: db.split_data_cache,
  })
}

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
      // FX rates and split data are re-fetchable, but user transactions are
      // not — salvage them before deleting the incompatible database
      const salvaged = await salvageTransactions()
      await db.delete()
      // Reopen with fresh schema
      await db.open()
      if (salvaged.length > 0) {
        try {
          await db.transactions.bulkPut(salvaged)
          console.warn(`Restored ${salvaged.length} transactions after database reset`)
        } catch (restoreError) {
          console.error('Failed to restore transactions after database reset:', restoreError)
        }
      }
    } else {
      // Re-throw unexpected errors
      throw error
    }
  }
}

/**
 * Best-effort read of the transactions table from an incompatible database.
 *
 * Opens the existing database in Dexie's dynamic mode (no schema declaration),
 * which works regardless of how the stored schema diverges from the current
 * code. Returns an empty array if anything fails.
 */
async function salvageTransactions(): Promise<GenericTransaction[]> {
  const legacyDb = new Dexie('cgt-visualizer')
  try {
    await legacyDb.open()
    if (!legacyDb.tables.some(t => t.name === 'transactions')) {
      return []
    }
    return await legacyDb.table<GenericTransaction, string>('transactions').toArray()
  } catch (error) {
    console.warn('Could not salvage transactions from incompatible database:', error)
    return []
  } finally {
    legacyDb.close()
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
