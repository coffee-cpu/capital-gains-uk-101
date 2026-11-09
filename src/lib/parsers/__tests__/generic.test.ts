import { describe, it, expect } from 'vitest'
import { normalizeGenericTransactions } from '../generic'
import { TransactionType } from '../../../types/transaction'
import type { SkippedRow } from '../../../types/brokerDefinition'

describe('Generic CSV Parser', () => {
  describe('normalizeGenericTransactions', () => {
    it('should normalize a basic BUY transaction', () => {
      const rows = [
        {
          date: '2024-01-15',
          type: 'BUY',
          symbol: 'AAPL',
          currency: 'USD',
          name: 'Apple Inc.',
          quantity: '10',
          price: '150.00',
          total: '1500.00',
          fee: '0.00',
          notes: '',
        },
      ]

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'test-file-1',
        source: 'Generic CSV',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2024-01-15',
        type: TransactionType.BUY,
        quantity: 10,
        price: 150.00,
        currency: 'USD',
        total: 1500.00,
        fee: 0,
        notes: null,
      })
    })

    it('should normalize a SELL transaction', () => {
      const rows = [
        {
          date: '2024-02-20',
          type: 'SELL',
          symbol: 'AAPL',
          currency: 'USD',
          quantity: '5',
          price: '160.00',
          total: '800.00',
          fee: '0.00',
        },
      ]

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.SELL)
      expect(result[0].quantity).toBe(5)
      expect(result[0].price).toBe(160.00)
    })

    it('should normalize a DIVIDEND transaction', () => {
      const rows = [
        {
          date: '2024-03-10',
          type: 'DIVIDEND',
          symbol: 'AAPL',
          currency: 'USD',
          total: '12.50',
          notes: 'Quarterly dividend',
        },
      ]

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.DIVIDEND)
      expect(result[0].quantity).toBeNull()
      expect(result[0].price).toBeNull()
      expect(result[0].total).toBe(12.50)
      expect(result[0].notes).toBe('Quarterly dividend')
    })

    it('should normalize a STOCK_SPLIT transaction with split_ratio', () => {
      const rows = [
        {
          date: '2024-06-10',
          type: 'STOCK_SPLIT',
          symbol: 'NVDA',
          currency: 'USD',
          split_ratio: '10:1',
        },
      ]

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'test-file-1',
        source: 'Generic CSV',
        symbol: 'NVDA',
        date: '2024-06-10',
        type: TransactionType.STOCK_SPLIT,
        currency: 'USD',
        ratio: '10:1',
        quantity: null,
        price: null,
        total: null,
      })
    })

    it('should normalize a STOCK_SPLIT transaction with 4:1 split_ratio', () => {
      const rows = [
        {
          date: '2020-08-31',
          type: 'STOCK_SPLIT',
          symbol: 'AAPL',
          currency: 'USD',
          split_ratio: '4:1',
        },
      ]

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.STOCK_SPLIT)
      expect(result[0].symbol).toBe('AAPL')
      expect(result[0].ratio).toBe('4:1')
    })

    it('should normalize a reverse STOCK_SPLIT transaction', () => {
      const rows = [
        {
          date: '2023-06-01',
          type: 'STOCK_SPLIT',
          symbol: 'XYZ',
          currency: 'USD',
          split_ratio: '1:10',
          notes: 'Reverse split',
        },
      ]

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.STOCK_SPLIT)
      expect(result[0].ratio).toBe('1:10')
      expect(result[0].notes).toBe('Reverse split')
    })

    it('should handle STOCK_SPLIT with missing ratio field', () => {
      const rows = [
        {
          date: '2024-06-10',
          type: 'STOCK_SPLIT',
          symbol: 'NVDA',
          currency: 'USD',
        },
      ]

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].ratio).toBeNull()
    })

    it('should handle multiple transactions with different types', () => {
      const rows = [
        {
          date: '2024-01-15',
          type: 'BUY',
          symbol: 'NVDA',
          currency: 'USD',
          quantity: '100',
          price: '100.00',
          total: '10000.00',
          fee: '',
          split_ratio: '',
          name: '',
          notes: '',
        },
        {
          date: '2024-06-10',
          type: 'STOCK_SPLIT',
          symbol: 'NVDA',
          currency: 'USD',
          split_ratio: '10:1',
          quantity: '',
          price: '',
          total: '',
          fee: '',
          name: '',
          notes: '',
        },
        {
          date: '2024-08-20',
          type: 'SELL',
          symbol: 'NVDA',
          currency: 'USD',
          quantity: '500',
          price: '120.00',
          total: '60000.00',
          fee: '',
          split_ratio: '',
          name: '',
          notes: '',
        },
      ]

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('test-file-1')
      expect(result[0].type).toBe(TransactionType.BUY)
      expect(result[1].id).toBe('test-file-2')
      expect(result[1].type).toBe(TransactionType.STOCK_SPLIT)
      expect(result[1].ratio).toBe('10:1')
      expect(result[2].id).toBe('test-file-3')
      expect(result[2].type).toBe(TransactionType.SELL)
    })

    it('should skip rows with missing required fields', () => {
      const rows = [
        {
          date: '',
          type: 'BUY',
          symbol: 'AAPL',
          currency: '',
          quantity: '',
          price: '',
          total: '',
          fee: '',
          split_ratio: '',
          name: '',
          notes: '',
        },
        {
          date: '2024-01-15',
          type: '',
          symbol: 'AAPL',
          currency: '',
          quantity: '',
          price: '',
          total: '',
          fee: '',
          split_ratio: '',
          name: '',
          notes: '',
        },
        {
          date: '2024-01-15',
          type: 'BUY',
          symbol: 'AAPL',
          currency: 'USD',
          quantity: '',
          price: '',
          total: '',
          fee: '',
          split_ratio: '',
          name: '',
          notes: '',
        },
      ]

      const skippedRows: { row: number; reason: string }[] = []
      const result = normalizeGenericTransactions(rows, 'test-file', skippedRows)

      expect(result).toHaveLength(1) // Only the last row is valid
      expect(result[0].id).toBe('test-file-1')
      expect(skippedRows).toEqual([
        { row: 2, reason: 'missing date' },
        { row: 3, reason: 'missing type' },
      ])
    })

    it('should handle invalid transaction types', () => {
      const rows = [
        {
          date: '2024-01-15',
          type: 'INVALID_TYPE',
          symbol: 'AAPL',
          currency: 'USD',
          quantity: '',
          price: '',
          total: '',
          fee: '',
          split_ratio: '',
          name: '',
          notes: '',
        },
      ]

      const skippedRows: { row: number; reason: string }[] = []
      const result = normalizeGenericTransactions(rows, 'test-file', skippedRows)

      expect(result).toHaveLength(0)
      expect(skippedRows).toEqual([{ row: 2, reason: 'unrecognised type "INVALID_TYPE"' }])
    })

    it('should handle case-insensitive transaction types', () => {
      const rows = [
        {
          date: '2024-01-15',
          type: 'buy',
          symbol: 'AAPL',
          currency: 'USD',
          quantity: '',
          price: '',
          total: '',
          fee: '',
          split_ratio: '',
          name: '',
          notes: '',
        },
        {
          date: '2024-02-15',
          type: 'Stock_Split',
          symbol: 'NVDA',
          currency: 'USD',
          split_ratio: '10:1',
          quantity: '',
          price: '',
          total: '',
          fee: '',
          name: '',
          notes: '',
        },
      ]

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(2)
      expect(result[0].type).toBe(TransactionType.BUY)
      expect(result[1].type).toBe(TransactionType.STOCK_SPLIT)
    })

    it('skips a row with no currency instead of guessing one', () => {
      const rows = [
        { date: '2024-01-15', type: 'BUY', symbol: 'AAPL', currency: '', quantity: '10', price: '100', total: '1000', fee: '' },
      ]
      const skipped: SkippedRow[] = []

      const result = normalizeGenericTransactions(rows, 'test-file', skipped)

      expect(result).toEqual([])
      expect(skipped).toEqual([{ row: 2, reason: 'missing currency (e.g. GBP or USD)' }])
    })

    it('lets a STOCK_SPLIT row leave the currency blank', () => {
      const rows = [
        { date: '2024-06-10', type: 'STOCK_SPLIT', symbol: 'NVDA', currency: '', split_ratio: '10:1' },
      ]

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].currency).toBe('GBP')
      expect(result[0].ratio).toBe('10:1')
    })

    it('reads the currency code in any letter case', () => {
      const rows = [{ date: '2024-01-15', type: 'BUY', symbol: 'AAPL', currency: 'usd', quantity: '1', price: '1', total: '1' }]
      expect(normalizeGenericTransactions(rows, 'test-file')[0].currency).toBe('USD')
    })
  })
})

describe('Generic CSV Parser - number and date validation', () => {
  const row = (overrides: Record<string, string>) => ({
    date: '2024-01-15', type: 'BUY', symbol: 'AAPL', currency: 'USD',
    quantity: '10', price: '150', total: '1500', fee: '0', ...overrides,
  })

  it('reads thousands separators and currency symbols in amounts', () => {
    const [tx] = normalizeGenericTransactions(
      [row({ quantity: '1,000', price: '$1,250.50', total: '1,250,500.00', fee: '£1.50' })],
      'f'
    )
    expect(tx).toMatchObject({ quantity: 1000, price: 1250.5, total: 1250500, fee: 1.5 })
  })

  it('skips rows whose date is not YYYY-MM-DD instead of guessing', () => {
    const skippedRows: { row: number; reason: string }[] = []
    const result = normalizeGenericTransactions(
      [row({ date: '15/01/2024' }), row({ date: '2024-02-30' }), row({ date: '2024-1-5' }), row({})],
      'f',
      skippedRows
    )

    expect(result).toHaveLength(1)
    expect(skippedRows.map(s => s.reason)).toEqual([
      'date "15/01/2024" is not in YYYY-MM-DD format',
      'date "2024-02-30" is not in YYYY-MM-DD format',
      'date "2024-1-5" is not in YYYY-MM-DD format',
    ])
  })

  it('accepts 29 February in a leap year', () => {
    expect(normalizeGenericTransactions([row({ date: '2024-02-29' })], 'f')).toHaveLength(1)
  })
})

describe('Generic CSV Parser - isin', () => {
  const row = (isin: string) => ({
    date: '2024-01-15', type: 'BUY', symbol: 'VUSA', currency: 'GBP',
    quantity: '1', price: '50', total: '50', fee: '0', isin,
  })

  it('reads an ISIN, upper-casing it', () => {
    const [tx] = normalizeGenericTransactions([row('ie00b3xxrp09')], 'f')
    expect(tx.isin).toBe('IE00B3XXRP09')
  })

  it('skips a row whose ISIN is malformed', () => {
    const skippedRows: { row: number; reason: string }[] = []
    expect(normalizeGenericTransactions([row('IE00B3')], 'f', skippedRows)).toHaveLength(0)
    expect(skippedRows[0].reason).toBe('isin "IE00B3" is not a 12-character ISIN')
  })
})

describe('Generic CSV Parser - asset_class', () => {
  const row = (assetClass: string) => ({
    date: '2024-01-15', type: 'BUY', symbol: 'BTC', currency: 'GBP',
    quantity: '0.1', price: '30000', total: '3000', fee: '0', asset_class: assetClass,
  })

  it('reads crypto and share, case-insensitively', () => {
    const [crypto, share, blank] = normalizeGenericTransactions([row('Crypto'), row('share'), row('')], 'f')
    expect(crypto.asset_class).toBe('crypto')
    expect(share.asset_class).toBe('share')
    expect(blank.asset_class).toBeUndefined()
  })

  it('skips a row with an unrecognised asset_class instead of guessing', () => {
    const skippedRows: { row: number; reason: string }[] = []
    const result = normalizeGenericTransactions([row('bond')], 'f', skippedRows)
    expect(result).toHaveLength(0)
    expect(skippedRows[0].reason).toBe('unrecognised asset_class "bond" (use share or crypto)')
  })
})
