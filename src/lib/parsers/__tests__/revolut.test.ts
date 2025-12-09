import { describe, it, expect } from 'vitest'
import { normalizeRevolutTransactions } from '../revolut'
import { TransactionType } from '../../../types/transaction'

describe('Revolut Parser', () => {
  describe('normalizeRevolutTransactions', () => {
    it('should normalize a BUY - MARKET transaction', () => {
      const rows = [
        {
          'Date': '2024-01-15T10:30:45.123Z',
          'Ticker': 'AAPL',
          'Type': 'BUY - MARKET',
          'Quantity': '10.25684932',
          'Price per share': '$182.50',
          'Total Amount': '$1,871.87',
          'Currency': 'USD',
          'FX Rate': '1.2751',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'test-file-1',
        source: 'Revolut',
        symbol: 'AAPL',
        date: '2024-01-15',
        type: TransactionType.BUY,
        quantity: 10.25684932,
        price: 182.50,
        currency: 'USD',
        total: 1871.87,
        notes: 'BUY - MARKET',
      })
    })

    it('should normalize a BUY - LIMIT transaction', () => {
      const rows = [
        {
          'Date': '2024-01-15T10:40:18.789Z',
          'Ticker': 'GOOGL',
          'Type': 'BUY - LIMIT',
          'Quantity': '7.89654321',
          'Price per share': '$139.80',
          'Total Amount': '$1,104.13',
          'Currency': 'USD',
          'FX Rate': '1.2752',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.BUY)
      expect(result[0].symbol).toBe('GOOGL')
      expect(result[0].quantity).toBe(7.89654321)
      expect(result[0].price).toBe(139.80)
      expect(result[0].total).toBe(1104.13)
    })

    it('should normalize a SELL - MARKET transaction', () => {
      const rows = [
        {
          'Date': '2024-04-15T13:45:00.012345Z',
          'Ticker': 'TSLA',
          'Type': 'SELL - MARKET',
          'Quantity': '5.00000000',
          'Price per share': '$195.78',
          'Total Amount': '$978.90',
          'Currency': 'USD',
          'FX Rate': '1.2415',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.SELL)
      expect(result[0].quantity).toBe(5.00)
      expect(result[0].price).toBe(195.78)
      expect(result[0].total).toBe(978.90)
    })

    it('should normalize a DIVIDEND transaction', () => {
      const rows = [
        {
          'Date': '2024-02-14T05:15:23.333333Z',
          'Ticker': 'AAPL',
          'Type': 'DIVIDEND',
          'Quantity': '',
          'Price per share': '',
          'Total Amount': '$2.35',
          'Currency': 'USD',
          'FX Rate': '1.2589',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.DIVIDEND)
      expect(result[0].symbol).toBe('AAPL')
      expect(result[0].quantity).toBeNull()
      expect(result[0].price).toBeNull()
      expect(result[0].total).toBe(2.35)
    })

    it('should normalize a CUSTODY FEE transaction', () => {
      const rows = [
        {
          'Date': '2024-02-01T08:15:42.567890Z',
          'Ticker': '',
          'Type': 'CUSTODY FEE',
          'Quantity': '',
          'Price per share': '',
          'Total Amount': '-$0.85',
          'Currency': 'USD',
          'FX Rate': '1.2655',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.FEE)
      expect(result[0].symbol).toBe('')
      expect(result[0].total).toBe(-0.85)
      expect(result[0].notes).toBe('CUSTODY FEE')
    })

    it('should normalize a CASH TOP-UP transaction', () => {
      const rows = [
        {
          'Date': '2024-01-15T10:00:00.000000Z',
          'Ticker': '',
          'Type': 'CASH TOP-UP',
          'Quantity': '',
          'Price per share': '',
          'Total Amount': '$5,000',
          'Currency': 'USD',
          'FX Rate': '1.2750',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.TRANSFER)
      expect(result[0].symbol).toBe('')
      expect(result[0].total).toBe(5000)
      expect(result[0].notes).toBe('CASH TOP-UP')
    })

    it('should normalize a CASH WITHDRAWAL transaction', () => {
      const rows = [
        {
          'Date': '2024-05-10T14:45:05.678901Z',
          'Ticker': '',
          'Type': 'CASH WITHDRAWAL',
          'Quantity': '',
          'Price per share': '',
          'Total Amount': '-$617.11',
          'Currency': 'USD',
          'FX Rate': '1.2325',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.TRANSFER)
      expect(result[0].total).toBe(-617.11)
    })

    it('should normalize a TRANSFER transaction', () => {
      const rows = [
        {
          'Date': '2025-03-05T11:41:08.345678Z',
          'Ticker': 'TSLA',
          'Type': 'TRANSFER FROM REVOLUT TRADING LTD TO REVOLUT SECURITIES EUROPE UAB',
          'Quantity': '25.67890123',
          'Price per share': '',
          'Total Amount': '$0',
          'Currency': 'USD',
          'FX Rate': '1.1206',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.TRANSFER)
      expect(result[0].symbol).toBe('TSLA')
      expect(result[0].quantity).toBe(25.67890123)
      expect(result[0].total).toBe(0)
    })

    it('should handle empty rows correctly', () => {
      const rows = [
        {
          'Date': '',
          'Ticker': '',
          'Type': '',
          'Quantity': '',
          'Price per share': '',
          'Total Amount': '',
          'Currency': '',
          'FX Rate': '',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(0)
    })

    it('should process multiple transactions with sequential IDs', () => {
      const rows = [
        {
          'Date': '2024-01-15T10:30:45.123Z',
          'Ticker': 'AAPL',
          'Type': 'BUY - MARKET',
          'Quantity': '10.25684932',
          'Price per share': '$182.50',
          'Total Amount': '$1,871.87',
          'Currency': 'USD',
          'FX Rate': '1.2751',
        },
        {
          'Date': '2024-01-15T10:35:22.456Z',
          'Ticker': 'MSFT',
          'Type': 'BUY - MARKET',
          'Quantity': '5.13248765',
          'Price per share': '$398.75',
          'Total Amount': '$2,046.55',
          'Currency': 'USD',
          'FX Rate': '1.2752',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('test-file-1')
      expect(result[1].id).toBe('test-file-2')
    })

    it('should extract currency from amount symbol', () => {
      const rows = [
        {
          'Date': '2024-01-15T10:30:45.123Z',
          'Ticker': 'AAPL',
          'Type': 'BUY - MARKET',
          'Quantity': '10',
          'Price per share': '$182.50',
          'Total Amount': '$1,825.00',
          'Currency': 'USD',
          'FX Rate': '1.2751',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].currency).toBe('USD')
    })

    it('should handle GBP currency symbol', () => {
      const rows = [
        {
          'Date': '2024-01-15T10:30:45.123Z',
          'Ticker': 'VWRP',
          'Type': 'BUY - MARKET',
          'Quantity': '10',
          'Price per share': '£100.00',
          'Total Amount': '£1,000.00',
          'Currency': 'GBP',
          'FX Rate': '1.0000',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].currency).toBe('GBP')
      expect(result[0].price).toBe(100.00)
      expect(result[0].total).toBe(1000.00)
    })

    it('should handle EUR currency symbol', () => {
      const rows = [
        {
          'Date': '2024-01-15T10:30:45.123Z',
          'Ticker': 'SAP',
          'Type': 'BUY - MARKET',
          'Quantity': '10',
          'Price per share': '€150.00',
          'Total Amount': '€1,500.00',
          'Currency': 'EUR',
          'FX Rate': '1.1500',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].currency).toBe('EUR')
      expect(result[0].price).toBe(150.00)
      expect(result[0].total).toBe(1500.00)
    })

    it('should handle negative amounts correctly', () => {
      const rows = [
        {
          'Date': '2024-02-01T08:15:42.567890Z',
          'Ticker': '',
          'Type': 'CUSTODY FEE',
          'Quantity': '',
          'Price per share': '',
          'Total Amount': '-$0.85',
          'Currency': 'USD',
          'FX Rate': '1.2655',
        },
        {
          'Date': '2024-05-10T14:45:05.678901Z',
          'Ticker': '',
          'Type': 'CASH WITHDRAWAL',
          'Quantity': '',
          'Price per share': '',
          'Total Amount': '-$617.11',
          'Currency': 'USD',
          'FX Rate': '1.2325',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(2)
      expect(result[0].total).toBe(-0.85)
      expect(result[1].total).toBe(-617.11)
    })

    it('should default to USD if no currency specified', () => {
      const rows = [
        {
          'Date': '2024-01-15T10:30:45.123Z',
          'Ticker': 'AAPL',
          'Type': 'BUY - MARKET',
          'Quantity': '10',
          'Price per share': '182.50',
          'Total Amount': '1825.00',
          'Currency': '',
          'FX Rate': '1.2751',
        },
      ]

      const result = normalizeRevolutTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].currency).toBe('USD')
    })
  })
})
