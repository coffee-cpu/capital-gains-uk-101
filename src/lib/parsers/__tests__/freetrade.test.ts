import { describe, it, expect } from 'vitest'
import { normalizeFreetradeTransactions } from '../freetrade'
import { TransactionType } from '../../../types/transaction'

describe('Freetrade Parser', () => {
  describe('normalizeFreetradeTransactions', () => {
    it('should normalize a BUY order transaction', () => {
      const rows = [
        {
          'Title': 'RetailGroup',
          'Type': 'ORDER',
          'Timestamp': '2025-07-10T09:15:42.456Z',
          'Account Currency': 'GBP',
          'Total Amount': '1800.50',
          'Buy / Sell': 'BUY',
          'Ticker': 'RTLG',
          'ISIN': 'GB1122334455',
          'Price per Share in Account Currency': '45.01250000',
          'Stamp Duty': '0.00',
          'Quantity': '40.00000000',
          'Venue': 'Multiple',
          'Order ID': 'ORD987654321',
          'Order Type': 'MARKET',
          'Instrument Currency': 'GBP',
          'Total Shares Amount': '1800.50',
          'Price per Share': '45.01250000',
          'FX Rate': '',
          'Base FX Rate': '',
          'FX Fee (BPS)': '0',
          'FX Fee Amount': '',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'test-file-1',
        source: 'Freetrade',
        symbol: 'RTLG',
        name: 'RetailGroup',
        date: '2025-07-10',
        type: TransactionType.BUY,
        quantity: 40.0,
        price: 45.0125,
        currency: 'GBP',
        total: 1800.50,
      })
      expect(result[0].fee).toBeNull() // Zero stamp duty and no FX fee
      expect(result[0].notes).toBe('ISIN: GB1122334455')
    })

    it('should normalize a SELL order transaction', () => {
      const rows = [
        {
          'Title': 'GlobalBank',
          'Type': 'ORDER',
          'Timestamp': '2025-07-15T14:30:25.123Z',
          'Account Currency': 'GBP',
          'Total Amount': '2500.00',
          'Buy / Sell': 'SELL',
          'Ticker': 'GBNK',
          'ISIN': 'GB0987654321',
          'Price per Share in Account Currency': '125.00000000',
          'Stamp Duty': '0.00',
          'Quantity': '20.00000000',
          'Venue': 'London Stock Exchange',
          'Order ID': 'ORD123456789',
          'Order Type': 'BASIC',
          'Instrument Currency': 'GBP',
          'Total Shares Amount': '2500.00',
          'Price per Share': '125.00000000',
          'FX Rate': '',
          'Base FX Rate': '',
          'FX Fee (BPS)': '0',
          'FX Fee Amount': '',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.SELL)
      expect(result[0].quantity).toBe(20.0)
      expect(result[0].price).toBe(125.0)
      expect(result[0].total).toBe(2500.0)
    })

    it('should normalize a DIVIDEND transaction', () => {
      const rows = [
        {
          'Title': 'TechCorp',
          'Type': 'DIVIDEND',
          'Timestamp': '2025-09-20T11:30:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '3.50',
          'Buy / Sell': '',
          'Ticker': 'TECH',
          'ISIN': 'US1234567890',
          'Price per Share in Account Currency': '',
          'Stamp Duty': '',
          'Quantity': '10.00000000',
          'Venue': '',
          'Order ID': '',
          'Order Type': '',
          'Instrument Currency': 'USD',
          'Total Shares Amount': '',
          'Price per Share': '',
          'FX Rate': '0.78500000',
          'Base FX Rate': '',
          'FX Fee (BPS)': '0',
          'FX Fee Amount': '0.00',
          'Dividend Ex Date': '2025-08-25',
          'Dividend Pay Date': '2025-09-20',
          'Dividend Eligible Quantity': '10.00000000',
          'Dividend Amount Per Share': '0.55000000',
          'Dividend Gross Distribution Amount': '5.50',
          'Dividend Net Distribution Amount': '4.68',
          'Dividend Withheld Tax Percentage': '15',
          'Dividend Withheld Tax Amount': '0.83',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        source: 'Freetrade',
        symbol: 'TECH',
        type: TransactionType.DIVIDEND,
        date: '2025-09-20',
        quantity: 10.0,
        total: 4.68, // Net distribution
        fee: null, // Withheld tax is now in dedicated field, not fee
        currency: 'GBP',
        grossDividend: 5.50, // Gross before withholding
        withholdingTax: 0.83, // Tax withheld
      })
      expect(result[0].notes).toContain('Gross: 5.5')
      expect(result[0].notes).toContain('Tax withheld: 0.83')
    })

    it('should normalize an INTEREST_FROM_CASH transaction', () => {
      const rows = [
        {
          'Title': 'Interest',
          'Type': 'INTEREST_FROM_CASH',
          'Timestamp': '2025-10-15T00:00:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '0.15',
          'Buy / Sell': '',
          'Ticker': '',
          'ISIN': '',
          'Price per Share in Account Currency': '',
          'Stamp Duty': '',
          'Quantity': '',
          'Venue': '',
          'Order ID': '',
          'Order Type': '',
          'Instrument Currency': '',
          'Total Shares Amount': '',
          'Price per Share': '',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        source: 'Freetrade',
        symbol: 'CASH',
        name: 'Interest from Cash',
        type: TransactionType.INTEREST,
        date: '2025-10-15',
        total: 0.15,
        currency: 'GBP',
      })
    })

    it('should normalize a TOP_UP transaction', () => {
      const rows = [
        {
          'Title': 'Top up',
          'Type': 'TOP_UP',
          'Timestamp': '2024-09-30T09:00:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '10000.00',
          'Buy / Sell': '',
          'Ticker': '',
          'ISIN': '',
          'Price per Share in Account Currency': '',
          'Stamp Duty': '',
          'Quantity': '',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        source: 'Freetrade',
        symbol: 'CASH',
        name: 'Top up',
        type: TransactionType.TRANSFER,
        date: '2024-09-30',
        total: 10000.0,
        currency: 'GBP',
      })
      expect(result[0].notes).toBe('Deposit')
    })

    it('should normalize a WITHDRAWAL transaction', () => {
      const rows = [
        {
          'Title': 'Withdrawal',
          'Type': 'WITHDRAWAL',
          'Timestamp': '2024-11-15T14:30:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '5000.00',
          'Buy / Sell': '',
          'Ticker': '',
          'ISIN': '',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        source: 'Freetrade',
        symbol: 'CASH',
        name: 'Withdrawal',
        type: TransactionType.TRANSFER,
        date: '2024-11-15',
        total: 5000.0,
        currency: 'GBP',
      })
      expect(result[0].notes).toBe('Withdrawal')
    })

    it('should skip MONTHLY_STATEMENT entries', () => {
      const rows = [
        {
          'Title': 'November Statement',
          'Type': 'MONTHLY_STATEMENT',
          'Timestamp': '2025-11-01T00:00:00.000Z',
          'Account Currency': '',
          'Total Amount': '',
          'Buy / Sell': '',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(0)
    })

    it('should skip TAX_CERTIFICATE entries', () => {
      const rows = [
        {
          'Title': 'Tax Certificate 2024-25',
          'Type': 'TAX_CERTIFICATE',
          'Timestamp': '2025-10-28T17:24:15.603Z',
          'Account Currency': '',
          'Total Amount': '',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(0)
    })

    it('should skip rows with invalid dates', () => {
      const rows = [
        {
          'Title': 'Test',
          'Type': 'ORDER',
          'Timestamp': 'Invalid Date',
          'Account Currency': 'GBP',
          'Total Amount': '100.00',
          'Buy / Sell': 'BUY',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(0)
    })

    it('should process multiple transactions with sequential IDs', () => {
      const rows = [
        {
          'Title': 'Buy 1',
          'Type': 'ORDER',
          'Timestamp': '2025-01-10T10:00:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '1000.00',
          'Buy / Sell': 'BUY',
          'Ticker': 'STOCK1',
          'ISIN': 'GB0000000001',
          'Price per Share in Account Currency': '10.00',
          'Quantity': '100.00',
          'Stamp Duty': '0.00',
        },
        {
          'Title': 'Interest',
          'Type': 'INTEREST_FROM_CASH',
          'Timestamp': '2025-01-15T00:00:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '0.50',
          'Buy / Sell': '',
          'Ticker': '',
          'ISIN': '',
          'Price per Share in Account Currency': '',
          'Quantity': '',
          'Stamp Duty': '',
        },
        {
          'Title': 'November Statement',
          'Type': 'MONTHLY_STATEMENT',
          'Timestamp': '2025-02-01T00:00:00.000Z',
          'Account Currency': '',
          'Total Amount': '',
          'Buy / Sell': '',
          'Ticker': '',
          'ISIN': '',
          'Price per Share in Account Currency': '',
          'Quantity': '',
          'Stamp Duty': '',
        },
        {
          'Title': 'Sell 1',
          'Type': 'ORDER',
          'Timestamp': '2025-02-10T14:00:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '1200.00',
          'Buy / Sell': 'SELL',
          'Ticker': 'STOCK1',
          'ISIN': 'GB0000000001',
          'Price per Share in Account Currency': '12.00',
          'Quantity': '100.00',
          'Stamp Duty': '0.00',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(3) // 2 orders + 1 interest (statement skipped)
      expect(result[0].id).toBe('test-file-1')
      expect(result[0].type).toBe(TransactionType.BUY)
      expect(result[1].id).toBe('test-file-2')
      expect(result[1].type).toBe(TransactionType.INTEREST)
      expect(result[2].id).toBe('test-file-3')
      expect(result[2].type).toBe(TransactionType.SELL)
    })

    it('should parse ISO timestamp dates correctly', () => {
      const rows = [
        {
          'Title': 'Test',
          'Type': 'ORDER',
          'Timestamp': '2025-03-15T14:25:33.789Z',
          'Account Currency': 'GBP',
          'Total Amount': '100.00',
          'Buy / Sell': 'BUY',
          'Ticker': 'TEST',
          'ISIN': 'GB0000000000',
          'Price per Share in Account Currency': '10.00',
          'Quantity': '10.00',
          'Stamp Duty': '0.00',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].date).toBe('2025-03-15')
    })

    it('should handle fractional shares', () => {
      const rows = [
        {
          'Title': 'TechStock',
          'Type': 'ORDER',
          'Timestamp': '2025-01-20T10:00:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '157.50',
          'Buy / Sell': 'BUY',
          'Ticker': 'TECH',
          'ISIN': 'US0000000000',
          'Price per Share in Account Currency': '45.00',
          'Quantity': '3.50000000',
          'Stamp Duty': '0.00',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].quantity).toBe(3.5)
      expect(result[0].price).toBe(45.0)
    })

    it('should handle stamp duty as fee', () => {
      const rows = [
        {
          'Title': 'UKStock',
          'Type': 'ORDER',
          'Timestamp': '2025-01-25T11:00:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '5002.50',
          'Buy / Sell': 'BUY',
          'Ticker': 'UKST',
          'ISIN': 'GB1111111111',
          'Price per Share in Account Currency': '50.00',
          'Quantity': '100.00',
          'Stamp Duty': '2.50',
          'FX Fee Amount': '',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].fee).toBe(2.5)
      expect(result[0].total).toBe(5002.5)
      expect(result[0].notes).toContain('Stamp Duty: 2.5')
    })

    it('should handle FX fees as allowable costs', () => {
      const rows = [
        {
          'Title': 'USStock',
          'Type': 'ORDER',
          'Timestamp': '2025-02-10T10:00:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '1000.00',
          'Buy / Sell': 'BUY',
          'Ticker': 'USST',
          'ISIN': 'US1234567890',
          'Price per Share in Account Currency': '100.00',
          'Quantity': '10.00',
          'Stamp Duty': '0.00',
          'FX Fee Amount': '3.90',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].fee).toBe(3.90)
      expect(result[0].total).toBe(1000.0)
      expect(result[0].notes).toContain('FX Fee: 3.9')
    })

    it('should combine stamp duty and FX fees', () => {
      const rows = [
        {
          'Title': 'EUStock',
          'Type': 'ORDER',
          'Timestamp': '2025-03-15T14:00:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '2000.00',
          'Buy / Sell': 'BUY',
          'Ticker': 'EUST',
          'ISIN': 'DE0000000000',
          'Price per Share in Account Currency': '50.00',
          'Quantity': '40.00',
          'Stamp Duty': '10.00',
          'FX Fee Amount': '7.80',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].fee).toBe(17.80) // 10.00 + 7.80
      expect(result[0].total).toBe(2000.0)
      expect(result[0].notes).toContain('Stamp Duty: 10')
      expect(result[0].notes).toContain('FX Fee: 7.8')
    })

    it('should not add fee notes when fees are zero', () => {
      const rows = [
        {
          'Title': 'Stock',
          'Type': 'ORDER',
          'Timestamp': '2025-04-20T10:00:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '500.00',
          'Buy / Sell': 'BUY',
          'Ticker': 'STK',
          'ISIN': 'GB0000000000',
          'Price per Share in Account Currency': '50.00',
          'Quantity': '10.00',
          'Stamp Duty': '0.00',
          'FX Fee Amount': '0.00',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].fee).toBeNull()
      expect(result[0].notes).toBe('ISIN: GB0000000000') // Only ISIN, no fee notes
    })

    it('should handle FREESHARE_ORDER with zero acquisition cost', () => {
      const rows = [
        {
          'Title': 'FreeStock',
          'Type': 'FREESHARE_ORDER',
          'Timestamp': '2025-05-10T12:00:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '0.00',
          'Buy / Sell': 'BUY',
          'Ticker': 'FREE',
          'ISIN': 'US9999999999',
          'Price per Share in Account Currency': '0.00',
          'Quantity': '1.00000000',
          'Stamp Duty': '0.00',
          'FX Fee Amount': '0.00',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        source: 'Freetrade',
        symbol: 'FREE',
        name: 'FreeStock',
        type: TransactionType.BUY,
        date: '2025-05-10',
        quantity: 1.0,
        price: 0, // Zero acquisition cost
        total: 0, // Zero total
        fee: null,
        currency: 'GBP',
      })
      expect(result[0].notes).toContain('Free share (£0 acquisition cost)')
      expect(result[0].notes).toContain('ISIN: US9999999999')
    })

    it('should handle FREESHARE_ORDER even when CSV has non-zero values', () => {
      // Some CSVs might have market value in the amount fields, but we override to £0
      const rows = [
        {
          'Title': 'PromotionStock',
          'Type': 'FREESHARE_ORDER',
          'Timestamp': '2025-06-01T09:00:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '50.00', // Market value shown, but we ignore this
          'Buy / Sell': 'BUY',
          'Ticker': 'PROMO',
          'ISIN': 'GB8888888888',
          'Price per Share in Account Currency': '50.00', // Market price, but we override
          'Quantity': '1.00000000',
          'Stamp Duty': '0.00',
          'FX Fee Amount': '0.00',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].price).toBe(0) // Overridden to 0
      expect(result[0].total).toBe(0) // Overridden to 0
      expect(result[0].fee).toBeNull()
      expect(result[0].notes).toContain('Free share (£0 acquisition cost)')
    })

    it('should handle fractional FREESHARE_ORDER', () => {
      const rows = [
        {
          'Title': 'FractionalFree',
          'Type': 'FREESHARE_ORDER',
          'Timestamp': '2025-07-01T10:00:00.000Z',
          'Account Currency': 'GBP',
          'Total Amount': '0.00',
          'Buy / Sell': 'BUY',
          'Ticker': 'FRAC',
          'ISIN': 'US7777777777',
          'Price per Share in Account Currency': '0.00',
          'Quantity': '0.50000000',
          'Stamp Duty': '0.00',
          'FX Fee Amount': '0.00',
        },
      ]

      const result = normalizeFreetradeTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].quantity).toBe(0.5)
      expect(result[0].price).toBe(0)
      expect(result[0].total).toBe(0)
      expect(result[0].notes).toContain('Free share (£0 acquisition cost)')
    })
  })
})
