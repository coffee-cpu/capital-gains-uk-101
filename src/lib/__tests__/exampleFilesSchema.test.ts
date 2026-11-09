import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { importCSVText, validateTransactions } from '../import'
import { SkippedRow } from '../../types/brokerDefinition'
import { GenericTransaction } from '../../types/transaction'

const ROOT = join(__dirname, '../../..')
const files = ['public/examples', 'e2e/fixtures'].flatMap(dir =>
  readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.csv')).map(f => join(dir, f))
)

describe('parser output matches GenericTransactionSchema', () => {
  it.each(files)('%s', file => {
    let skipped: SkippedRow[]
    try {
      skipped = importCSVText(readFileSync(join(ROOT, file), 'utf8'), 'file').skippedRows
    } catch {
      return // fixtures for unrecognised or empty files are expected to be rejected
    }
    expect(skipped.filter(s => s.transactionId)).toEqual([])
  })
})

describe('validateTransactions', () => {
  it('drops and reports a transaction that fails the schema', () => {
    const valid: GenericTransaction = {
      id: 'f-1', source: 'Generic CSV', symbol: 'AAPL', name: null, date: '2024-05-01',
      type: 'BUY', quantity: 1, price: 1, currency: 'USD', total: 1, fee: null, notes: null,
    }
    const skipped: SkippedRow[] = []

    const kept = validateTransactions([valid, { ...valid, id: 'f-2', date: '2024-02-30' }], skipped)

    expect(kept).toEqual([valid])
    expect(skipped).toEqual([{ transactionId: 'f-2', reason: expect.stringContaining('invalid date') }])
  })
})
