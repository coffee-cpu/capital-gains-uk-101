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
 * IndexedDB database for local storage
 */
export class CGTDatabase extends Dexie {
  transactions!: Table<GenericTransaction, string>
  fx_rates!: Table<FXRate, string>

  constructor() {
    super('cgt-visualizer')

    this.version(1).stores({
      transactions: 'id, source, symbol, date, type',
      fx_rates: '[date+currency], date, currency',
    })
  }
}

export const db = new CGTDatabase()
