import { describe, it, expect } from 'vitest'
import { normalizeGenericTransactions } from '../generic'
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

    it('should parse gross_dividend and withholding_tax for DIVIDEND transactions', () => {
      const rows = [
        {
          date: '2024-09-15',
          type: 'DIVIDEND',
          symbol: 'AAPL',
          currency: 'GBP',
          total: '21.25',
          gross_dividend: '25.00',
          withholding_tax: '3.75',
          notes: 'Quarterly dividend with NRA withholding',
        },
      ]

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.DIVIDEND)
      expect(result[0].total).toBe(21.25)
      expect(result[0].grossDividend).toBe(25.00)
      expect(result[0].withholdingTax).toBe(3.75)
    })

    it('should not include grossDividend/withholdingTax for non-DIVIDEND types', () => {
      const rows = [
        {
          date: '2024-01-15',
          type: 'BUY',
          symbol: 'AAPL',
          currency: 'GBP',
          quantity: '10',
          price: '150.00',
          total: '1500.00',
          gross_dividend: '100',
          withholding_tax: '15',
        },
      ]

      const result = normalizeGenericTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].grossDividend).toBeUndefined()
      expect(result[0].withholdingTax).toBeUndefined()
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
