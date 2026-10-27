import { describe, it, expect } from 'vitest'
import Papa from 'papaparse'
import { normalizeGenericTransactions } from '../generic'
import { buildTransactionsCSV } from '../../../utils/csvExport'
import { TransactionType } from '../../../types/transaction'

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

    describe('withholding-tax rows (TAX_ON_DIVIDEND / TAX_ON_INTEREST)', () => {
      const taxRow = (type: string, total: string) => ({
        date: '2024-09-29',
        type,
        symbol: type === 'TAX_ON_INTEREST' ? '' : 'AAPL',
        currency: 'USD',
        total,
      })

      it('reads unmarked amounts as tax withheld, including mixed older exports', () => {
        // Exports made before tax_sign existed held IB withholding as negative
        // and Schwab withholding as positive, side by side in one file
        const rows = [
          taxRow('TAX_ON_DIVIDEND', '-3.75'),  // IB Foreign Tax Withholding
          taxRow('TAX_ON_DIVIDEND', '3.75'),   // Schwab NRA Tax Adj (old absolute value)
          taxRow('TAX_ON_INTEREST', '0.50'),   // hand-entered
        ]

        const result = normalizeGenericTransactions(rows, 'test-file')

        expect(result.map(tx => tx.total)).toEqual([-3.75, -3.75, -0.5])
      })

      it('keeps the sign of rows marked tax_sign=signed', () => {
        const rows = [
          { ...taxRow('TAX_ON_DIVIDEND', '-3.75'), tax_sign: 'signed' },  // tax withheld
          { ...taxRow('TAX_ON_DIVIDEND', '3.75'), tax_sign: 'signed' },   // refund of that tax
        ]

        const result = normalizeGenericTransactions(rows, 'test-file')

        expect(result.map(tx => tx.total)).toEqual([-3.75, 3.75])
      })

      it('round-trips a refund through export and re-import', () => {
        const original = normalizeGenericTransactions([
          { ...taxRow('TAX_ON_DIVIDEND', '-3.75'), tax_sign: 'signed' },
          { ...taxRow('TAX_ON_DIVIDEND', '3.75'), tax_sign: 'signed' },
        ], 'test-file')

        const exported = Papa.parse<Record<string, string>>(buildTransactionsCSV(original), {
          header: true,
          skipEmptyLines: true,
        }).data
        const reimported = normalizeGenericTransactions(exported, 'reimport')

        expect(reimported.map(tx => tx.total)).toEqual([-3.75, 3.75])
      })
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

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(1) // Only the last row is valid
      expect(result[0].id).toBe('test-file-1')
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

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(0)
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

    it('should default to USD currency if not specified', () => {
      const rows = [
        {
          date: '2024-01-15',
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
      ]

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].currency).toBe('USD')
    })
  })
})
