import { BrokerType } from '../types/broker'
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

    // Version 5: Interactive Brokers debit (margin) interest was imported as
    // INTEREST, which counted it as negative interest income. It is a cost, so
    // it is now a FEE; convert rows imported before the parser change.
    this.version(5).stores({
      transactions: 'id, source, symbol, date, type',
      fx_rates: 'id, date, currency, fxSource',
      imported_files: 'fileId, filename, importedAt',
      settings: 'key',
      split_data_cache: 'year',
    }).upgrade(tx =>
      tx.table<GenericTransaction, string>('transactions')
        .where('type').equals('INTEREST')
        .modify(row => {
          if (isImportedIBDebitInterest(row)) row.type = 'FEE'
        })
    )
  }
}

/**
 * An Interactive Brokers margin interest charge stored as INTEREST by the
 * parser before database version 5. Older imports noted both margin interest
 * and bond accrued interest paid as "Debit Interest"; IB's description
 * ("USD Debit Interest for Jan-2022") tells them apart.
 */
export function isImportedIBDebitInterest(row: GenericTransaction): boolean {
  return (
    row.source === BrokerType.INTERACTIVE_BROKERS &&
    row.type === 'INTEREST' &&
    row.notes === 'Debit Interest' &&
    /debit interest/i.test(row.name ?? '')
  )
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
      // FX rates and split data are re-fetchable, but user transactions and
      // settings are not — salvage them before deleting the incompatible
      // database. Losing settings would silently switch the FX source back
      // to the default, changing the figures.
      const salvaged = await salvageUserData()
      await db.delete()
      // Reopen with fresh schema
      await db.open()
      if (salvaged.transactions.length > 0) {
        try {
          await db.transactions.bulkPut(salvaged.transactions)
          console.warn(`Restored ${salvaged.transactions.length} transactions after database reset`)
        } catch (restoreError) {
          console.error('Failed to restore transactions after database reset:', restoreError)
        }
      }
      if (salvaged.settings.length > 0) {
        try {
          await db.settings.bulkPut(salvaged.settings)
        } catch (restoreError) {
          console.error('Failed to restore settings after database reset:', restoreError)
        }
      }
    } else {
      // Re-throw unexpected errors
      throw error
    }
  }
}

/**
 * Best-effort read of the transactions and settings tables from an incompatible database.
 *
 * Opens the existing database in Dexie's dynamic mode (no schema declaration),
 * which works regardless of how the stored schema diverges from the current
 * code. A table that can't be read comes back empty.
 */
async function salvageUserData(): Promise<{ transactions: GenericTransaction[]; settings: UserSetting[] }> {
  const legacyDb = new Dexie('cgt-visualizer')
  try {
    await legacyDb.open()
    const readTable = async <T>(name: string): Promise<T[]> => {
      if (!legacyDb.tables.some(t => t.name === name)) return []
      try {
        return await legacyDb.table<T>(name).toArray()
      } catch (error) {
        console.warn(`Could not salvage ${name} from incompatible database:`, error)
        return []
      }
    }
    return {
      transactions: await readTable<GenericTransaction>('transactions'),
      settings: await readTable<UserSetting>('settings'),
    }
  } catch (error) {
    console.warn('Could not salvage data from incompatible database:', error)
    return { transactions: [], settings: [] }
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

  // Clear settings saved to localStorage by versions before IndexedDB held them
  localStorage.removeItem('cgt-settings')

  // Reload page to ensure clean state
  window.location.reload()
}
