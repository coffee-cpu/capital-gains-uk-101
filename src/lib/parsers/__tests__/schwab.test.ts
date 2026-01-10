import { describe, it, expect } from 'vitest'
import { normalizeSchwabTransactions } from '../schwab'
import { TransactionType } from '../../../types/transaction'

describe('Schwab Parser', () => {
  describe('normalizeSchwabTransactions', () => {
    it('should normalize a Buy transaction', () => {
      const rows = [
        {
          'Date': '03/15/2024',
          'Action': 'Buy',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '75',
          'Price': '170.00',
          'Fees & Comm': '$0.03',
          'Amount': '$12750.03',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'test-file-1',
        source: 'Charles Schwab',
        symbol: 'AAPL',
        name: 'APPLE INC',
        date: '2024-03-15',
        type: TransactionType.BUY,
        quantity: 75,
        price: 170.00,
        currency: 'USD',
        total: 12750.03,
        fee: 0.03,
      })
    })

    it('should normalize a Sell transaction', () => {
      const rows = [
        {
          'Date': '08/15/2024',
          'Action': 'Sell',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '50',
          'Price': '175.50',
          'Fees & Comm': '$0.02',
          'Amount': '$8774.98',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.SELL)
      expect(result[0].quantity).toBe(50)
      expect(result[0].price).toBe(175.50)
    })

    it('should normalize a Sell Short transaction with is_short_sell flag', () => {
      const rows = [
        {
          'Date': '07/25/2023',
          'Action': 'Sell Short',
          'Symbol': 'SNAP',
          'Description': 'SNAP INC CLASS A',
          'Quantity': '100',
          'Price': '$12.50',
          'Fees & Comm': '$0.02',
          'Amount': '$1249.98',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.SELL)
      expect(result[0].symbol).toBe('SNAP')
      expect(result[0].quantity).toBe(100)
      expect(result[0].price).toBe(12.50)
      expect(result[0].fee).toBe(0.02)
      expect(result[0].total).toBe(1249.98)
      expect(result[0].is_short_sell).toBe(true)
    })

    it('should not set is_short_sell for regular Sell transactions', () => {
      const rows = [
        {
          'Date': '08/15/2024',
          'Action': 'Sell',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '50',
          'Price': '175.50',
          'Fees & Comm': '$0.02',
          'Amount': '$8774.98',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.SELL)
      expect(result[0].is_short_sell).toBeUndefined()
    })

    it('should normalize dividend transactions', () => {
      const rows = [
        {
          'Date': '09/29/2024',
          'Action': 'Qualified Dividend',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '$15.75',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.DIVIDEND)
      expect(result[0].quantity).toBeNull()
      expect(result[0].total).toBe(15.75)
    })

    it('should normalize interest transactions', () => {
      const rows = [
        {
          'Date': '09/29/2024',
          'Action': 'Credit Interest',
          'Symbol': '',
          'Description': 'SCHWAB1 INT 08/28-09/28',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '$1.25',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.INTEREST)
      expect(result[0].symbol).toBe('')
    })

    it('should handle "as of" dates correctly', () => {
      const rows = [
        {
          'Date': '08/18/2024 as of 08/15/2024',
          'Action': 'Stock Plan Activity',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '17',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].date).toBe('2024-08-15') // Uses "as of" date (transaction date), not settlement date
      expect(result[0].type).toBe(TransactionType.BUY) // Stock Plan Activity = BUY
    })

    it('should mark Stock Plan Activity without price as incomplete/ignored', () => {
      const rows = [
        {
          'Date': '08/15/2024',
          'Action': 'Stock Plan Activity',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '17',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].incomplete).toBe(true)
      expect(result[0].ignored).toBe(true)
      expect(result[0].notes).toContain('Stock Plan Activity')
    })

    it('should NOT mark Stock Plan Activity as incomplete if it has price', () => {
      const rows = [
        {
          'Date': '08/15/2024',
          'Action': 'Stock Plan Activity',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '17',
          'Price': '$150.00',
          'Fees & Comm': '',
          'Amount': '',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.BUY)
      expect(result[0].price).toBe(150)
      expect(result[0].incomplete).toBeFalsy()
      expect(result[0].ignored).toBeFalsy()
      expect(result[0].notes).toBe('Stock Plan Activity') // Marked for deduplication
    })

    it('should handle negative amounts (tax adjustments)', () => {
      const rows = [
        {
          'Date': '09/29/2024',
          'Action': 'NRA Tax Adj',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '-$2.50',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.TAX)
      expect(result[0].total).toBe(2.50) // Absolute value
    })

    it('should skip rows with invalid dates', () => {
      const rows = [
        {
          'Date': 'Invalid Date',
          'Action': 'Buy',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '10',
          'Price': '100',
          'Fees & Comm': '',
          'Amount': '$1000',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(0)
    })

    it('should map unknown actions to TRANSFER type', () => {
      const rows = [
        {
          'Date': '03/15/2024',
          'Action': 'Unknown Action Type',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '10',
          'Price': '100',
          'Fees & Comm': '',
          'Amount': '$1000',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.TRANSFER)
    })

    it('should handle empty values correctly', () => {
      const rows = [
        {
          'Date': '09/29/2024',
          'Action': 'Credit Interest',
          'Symbol': '',
          'Description': 'Interest',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '$1.00',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].quantity).toBeNull()
      expect(result[0].price).toBeNull()
      expect(result[0].fee).toBeNull()
    })

    it('should handle wire transfers', () => {
      const rows = [
        {
          'Date': '09/03/2024',
          'Action': 'Wire Sent',
          'Symbol': '',
          'Description': 'WIRED FUNDS DISBURSED',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '-$1000.00',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.TRANSFER)
      expect(result[0].total).toBe(1000.00)
    })

    it('should normalize stock split transactions', () => {
      const rows = [
        {
          'Date': '08/31/2020',
          'Action': 'Stock Split',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC 4 FOR 1 STOCK SPLIT',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.STOCK_SPLIT)
      expect(result[0].symbol).toBe('AAPL')
      expect(result[0].date).toBe('2020-08-31')
      expect(result[0].ratio).toBe('4:1')
      expect(result[0].quantity).toBeNull()
      expect(result[0].price).toBeNull()
    })

    it('should parse 10-for-1 stock split ratio', () => {
      const rows = [
        {
          'Date': '06/10/2024',
          'Action': 'Stock Split',
          'Symbol': 'NVDA',
          'Description': 'NVIDIA CORP 10 FOR 1 STOCK SPLIT',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].ratio).toBe('10:1')
    })

    it('should parse reverse stock split ratio', () => {
      const rows = [
        {
          'Date': '06/10/2024',
          'Action': 'Stock Split',
          'Symbol': 'XYZ',
          'Description': 'COMPANY XYZ 1 FOR 10 STOCK SPLIT',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].ratio).toBe('1:10')
    })

    it('should process multiple transactions with sequential IDs', () => {
      const rows = [
        {
          'Date': '03/15/2024',
          'Action': 'Buy',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '10',
          'Price': '100',
          'Fees & Comm': '$0.01',
          'Amount': '$1000.01',
        },
        {
          'Date': '03/16/2024',
          'Action': 'Sell',
          'Symbol': 'MSFT',
          'Description': 'MICROSOFT CORP',
          'Quantity': '5',
          'Price': '200',
          'Fees & Comm': '$0.01',
          'Amount': '$999.99',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('test-file-1')
      expect(result[1].id).toBe('test-file-2')
    })
  })
})
