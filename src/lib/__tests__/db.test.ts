import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { CGTDatabase } from '../db'
import { GenericTransaction } from '../../types/transaction'

const DB_NAME = 'cgt-visualizer'

function storedRow(
  id: string,
  source: string,
  type: GenericTransaction['type'],
  total: number
): GenericTransaction {
  return {
    id,
    source,
    symbol: 'AAPL',
    name: null,
    date: '2024-09-29',
    type,
    quantity: null,
    price: null,
    currency: 'USD',
    total,
    fee: null,
    notes: null,
  }
}

/** Create a database at schema version 4 (before the signed convention) */
async function seedVersion4(rows: GenericTransaction[]): Promise<void> {
  const v4 = new Dexie(DB_NAME)
  v4.version(4).stores({
    transactions: 'id, source, symbol, date, type',
    fx_rates: 'id, date, currency, fxSource',
    imported_files: 'fileId, filename, importedAt',
    settings: 'key',
    split_data_cache: 'year',
  })
  await v4.table('transactions').bulkAdd(rows)
  v4.close()
}

describe('CGTDatabase', () => {
  beforeEach(async () => {
    await Dexie.delete(DB_NAME)
  })

  describe('version 5 upgrade: signed withholding-tax rows', () => {
    it('makes stored Schwab and Generic CSV withholding negative, keeping their figures', async () => {
      await seedVersion4([
        storedRow('schwab-tax', 'Charles Schwab', 'TAX_ON_DIVIDEND', 3.75),  // pre-fix absolute value
        storedRow('schwab-int', 'Charles Schwab', 'TAX_ON_INTEREST', 0.75),
        storedRow('generic-tax', 'Generic CSV', 'TAX_ON_DIVIDEND', 2),
      ])

      const db = new CGTDatabase()
      const rows = await db.transactions.toArray()
      db.close()

      expect(Object.fromEntries(rows.map(tx => [tx.id, tx.total]))).toEqual({
        'schwab-tax': -3.75,
        'schwab-int': -0.75,
        'generic-tax': -2,
      })
    })

    it('leaves Interactive Brokers tax rows and other transaction types unchanged', async () => {
      await seedVersion4([
        storedRow('ib-tax', 'Interactive Brokers', 'TAX_ON_DIVIDEND', -3.75),
        storedRow('ib-refund', 'Interactive Brokers', 'TAX_ON_DIVIDEND', 1.25),
        storedRow('schwab-div', 'Charles Schwab', 'DIVIDEND', 25),
      ])

      const db = new CGTDatabase()
      const rows = await db.transactions.toArray()
      db.close()

      expect(Object.fromEntries(rows.map(tx => [tx.id, tx.total]))).toEqual({
        'ib-tax': -3.75,
        'ib-refund': 1.25,
        'schwab-div': 25,
      })
    })
  })
})
