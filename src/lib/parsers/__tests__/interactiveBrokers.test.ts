import { describe, it, expect } from 'vitest'
import { normalizeInteractiveBrokersTransactions } from '../interactiveBrokers'
import { TransactionType } from '../../../types/transaction'

// Helper to create IB CSV row format (PapaParse with header:true)
const createIBRow = (data: Record<string, string>) => data

describe('Interactive Brokers Parser', () => {
  describe('normalizeInteractiveBrokersTransactions', () => {
    it('should normalize a Buy transaction from Trades section', () => {
      const rows = [
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Header',
          'DataDiscriminator': 'DataDiscriminator',
          'Asset Category': 'Asset Category',
          'Currency': 'Currency',
          'Symbol': 'Symbol',
          'Date/Time': 'Date/Time',
          'Exchange': 'Exchange',
          'Quantity': 'Quantity',
          'T. Price': 'T. Price',
          'Proceeds': 'Proceeds',
          'Comm/Fee': 'Comm/Fee',
          'Basis': 'Basis',
          'Realized P/L': 'Realized P/L',
          'Code': 'Code',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'Trade',
          'Asset Category': 'Stocks',
          'Currency': 'USD',
          'Symbol': 'AAPL',
          'Date/Time': '2024-03-15 10:30:42',
          'Exchange': 'NASDAQ',
          'Quantity': '100',
          'T. Price': '170.50',
          'Proceeds': '-17050.00',
          'Comm/Fee': '-1.00',
          'Basis': '',
          'Realized P/L': '',
          'Code': '',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'test-file-1',
        source: 'Interactive Brokers',
        symbol: 'AAPL',
        date: '2024-03-15',
        type: TransactionType.BUY,
        quantity: 100,
        price: 170.50,
        currency: 'USD',
        total: 17050.00,
        fee: 1.00,
      })
    })

    it('should normalize a Sell transaction (negative quantity)', () => {
      const rows = [
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Header',
          'DataDiscriminator': 'DataDiscriminator',
          'Asset Category': 'Asset Category',
          'Currency': 'Currency',
          'Symbol': 'Symbol',
          'Date/Time': 'Date/Time',
          'Exchange': 'Exchange',
          'Quantity': 'Quantity',
          'T. Price': 'T. Price',
          'Proceeds': 'Proceeds',
          'Comm/Fee': 'Comm/Fee',
          'Basis': 'Basis',
          'Realized P/L': 'Realized P/L',
          'Code': 'Code',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'Trade',
          'Asset Category': 'Stocks',
          'Currency': 'USD',
          'Symbol': 'UPST',
          'Date/Time': '2021-08-23 14:22:00',
          'Exchange': 'NASDAQ',
          'Quantity': '-50',
          'T. Price': '199.64',
          'Proceeds': '9982.00',
          'Comm/Fee': '-1.00',
          'Basis': '',
          'Realized P/L': '6937.94',
          'Code': '',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: TransactionType.SELL,
        quantity: 50, // Stored as positive
        price: 199.64,
        total: 9982.00,
        fee: 1.00,
      })
    })

    it('should handle non-USD currency', () => {
      const rows = [
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Header',
          'DataDiscriminator': 'DataDiscriminator',
          'Asset Category': 'Asset Category',
          'Currency': 'Currency',
          'Symbol': 'Symbol',
          'Date/Time': 'Date/Time',
          'Exchange': 'Exchange',
          'Quantity': 'Quantity',
          'T. Price': 'T. Price',
          'Proceeds': 'Proceeds',
          'Comm/Fee': 'Comm/Fee',
          'Basis': 'Basis',
          'Realized P/L': 'Realized P/L',
          'Code': 'Code',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'Trade',
          'Asset Category': 'Stocks',
          'Currency': 'SEK',
          'Symbol': 'HMBs',
          'Date/Time': '2024-06-15 09:15:30',
          'Exchange': 'STOCKHOLM',
          'Quantity': '-257',
          'T. Price': '176.85',
          'Proceeds': '45450.45',
          'Comm/Fee': '-2.50',
          'Basis': '',
          'Realized P/L': '9254.23',
          'Code': '',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        currency: 'SEK',
        symbol: 'HMBs',
      })
    })

    it('should skip Order rows (only process Trade rows)', () => {
      const rows = [
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Header',
          'DataDiscriminator': 'DataDiscriminator',
          'Asset Category': 'Asset Category',
          'Currency': 'Currency',
          'Symbol': 'Symbol',
          'Date/Time': 'Date/Time',
          'Exchange': 'Exchange',
          'Quantity': 'Quantity',
          'T. Price': 'T. Price',
          'Proceeds': 'Proceeds',
          'Comm/Fee': 'Comm/Fee',
          'Basis': 'Basis',
          'Realized P/L': 'Realized P/L',
          'Code': 'Code',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'Order',
          'Asset Category': 'Stocks',
          'Currency': 'USD',
          'Symbol': 'AAPL',
          'Date/Time': '2024-03-15 10:30:42',
          'Exchange': 'NASDAQ',
          'Quantity': '100',
          'T. Price': '170.50',
          'Proceeds': '-17050.00',
          'Comm/Fee': '-1.00',
          'Basis': '',
          'Realized P/L': '',
          'Code': '',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'Trade',
          'Asset Category': 'Stocks',
          'Currency': 'USD',
          'Symbol': 'AAPL',
          'Date/Time': '2024-03-15 10:30:42',
          'Exchange': 'NASDAQ',
          'Quantity': '100',
          'T. Price': '170.50',
          'Proceeds': '-17050.00',
          'Comm/Fee': '-1.00',
          'Basis': '',
          'Realized P/L': '',
          'Code': '',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1) // Only the "Trade" row, not "Order"
      expect(result[0].type).toBe(TransactionType.BUY)
    })

    it('should skip ClosedLot and SubTotal rows', () => {
      const rows = [
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Header',
          'DataDiscriminator': 'DataDiscriminator',
          'Asset Category': 'Asset Category',
          'Currency': 'Currency',
          'Symbol': 'Symbol',
          'Date/Time': 'Date/Time',
          'Exchange': 'Exchange',
          'Quantity': 'Quantity',
          'T. Price': 'T. Price',
          'Proceeds': 'Proceeds',
          'Comm/Fee': 'Comm/Fee',
          'Basis': 'Basis',
          'Realized P/L': 'Realized P/L',
          'Code': 'Code',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'Trade',
          'Asset Category': 'Stocks',
          'Currency': 'USD',
          'Symbol': 'UPST',
          'Date/Time': '2021-08-23 14:22:00',
          'Exchange': 'NASDAQ',
          'Quantity': '-50',
          'T. Price': '199.64',
          'Proceeds': '9982.00',
          'Comm/Fee': '-1.00',
          'Basis': '',
          'Realized P/L': '6937.94',
          'Code': '',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'ClosedLot',
          'Asset Category': 'Stocks',
          'Currency': 'USD',
          'Symbol': 'UPST',
          'Date/Time': '2021-03-15 11:00:00',
          'Exchange': 'NASDAQ',
          'Quantity': '50',
          'T. Price': '60.86',
          'Proceeds': '-3043.00',
          'Comm/Fee': '',
          'Basis': '3043.00',
          'Realized P/L': '',
          'Code': '',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'SubTotal',
          'Asset Category': 'Stocks',
          'Currency': 'USD',
          'Symbol': 'UPST',
          'Date/Time': '',
          'Exchange': '',
          'Quantity': '-50',
          'T. Price': '',
          'Proceeds': '9982.00',
          'Comm/Fee': '',
          'Basis': '',
          'Realized P/L': '6937.94',
          'Code': '',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1) // Only the "Trade" row
    })

    it('should skip non-stock asset categories', () => {
      const rows = [
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Header',
          'DataDiscriminator': 'DataDiscriminator',
          'Asset Category': 'Asset Category',
          'Currency': 'Currency',
          'Symbol': 'Symbol',
          'Date/Time': 'Date/Time',
          'Exchange': 'Exchange',
          'Quantity': 'Quantity',
          'T. Price': 'T. Price',
          'Proceeds': 'Proceeds',
          'Comm/Fee': 'Comm/Fee',
          'Basis': 'Basis',
          'Realized P/L': 'Realized P/L',
          'Code': 'Code',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'Trade',
          'Asset Category': 'Equity and Index Options',
          'Currency': 'USD',
          'Symbol': 'CLOV 16JUL21 20.0 C',
          'Date/Time': '2021-06-21 09:30:00',
          'Exchange': 'CBOE',
          'Quantity': '1',
          'T. Price': '1.46',
          'Proceeds': '146.00',
          'Comm/Fee': '-0.65',
          'Basis': '',
          'Realized P/L': '',
          'Code': '',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'Trade',
          'Asset Category': 'Stocks',
          'Currency': 'USD',
          'Symbol': 'AAPL',
          'Date/Time': '2024-03-15 10:30:42',
          'Exchange': 'NASDAQ',
          'Quantity': '100',
          'T. Price': '170.50',
          'Proceeds': '-17050.00',
          'Comm/Fee': '-1.00',
          'Basis': '',
          'Realized P/L': '',
          'Code': '',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1) // Only the Stocks row, not Options
      expect(result[0].symbol).toBe('AAPL')
    })

    it('should handle semicolon date/time separator', () => {
      const rows = [
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Header',
          'DataDiscriminator': 'DataDiscriminator',
          'Asset Category': 'Asset Category',
          'Currency': 'Currency',
          'Symbol': 'Symbol',
          'Date/Time': 'Date/Time',
          'Exchange': 'Exchange',
          'Quantity': 'Quantity',
          'T. Price': 'T. Price',
          'Proceeds': 'Proceeds',
          'Comm/Fee': 'Comm/Fee',
          'Basis': 'Basis',
          'Realized P/L': 'Realized P/L',
          'Code': 'Code',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'Trade',
          'Asset Category': 'Stocks',
          'Currency': 'USD',
          'Symbol': 'AAPL',
          'Date/Time': '2024-03-15;10:30:42',
          'Exchange': 'NASDAQ',
          'Quantity': '100',
          'T. Price': '170.50',
          'Proceeds': '-17050.00',
          'Comm/Fee': '-1.00',
          'Basis': '',
          'Realized P/L': '',
          'Code': '',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].date).toBe('2024-03-15')
    })

    it('should process multiple stock trades with sequential IDs', () => {
      const rows = [
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Header',
          'DataDiscriminator': 'DataDiscriminator',
          'Asset Category': 'Asset Category',
          'Currency': 'Currency',
          'Symbol': 'Symbol',
          'Date/Time': 'Date/Time',
          'Exchange': 'Exchange',
          'Quantity': 'Quantity',
          'T. Price': 'T. Price',
          'Proceeds': 'Proceeds',
          'Comm/Fee': 'Comm/Fee',
          'Basis': 'Basis',
          'Realized P/L': 'Realized P/L',
          'Code': 'Code',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'Trade',
          'Asset Category': 'Stocks',
          'Currency': 'USD',
          'Symbol': 'AAPL',
          'Date/Time': '2024-03-15 10:30:42',
          'Exchange': 'NASDAQ',
          'Quantity': '100',
          'T. Price': '170.50',
          'Proceeds': '-17050.00',
          'Comm/Fee': '-1.00',
          'Basis': '',
          'Realized P/L': '',
          'Code': '',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'Trade',
          'Asset Category': 'Stocks',
          'Currency': 'USD',
          'Symbol': 'MSFT',
          'Date/Time': '2024-03-16 14:20:30',
          'Exchange': 'NASDAQ',
          'Quantity': '-50',
          'T. Price': '400.00',
          'Proceeds': '20000.00',
          'Comm/Fee': '-2.00',
          'Basis': '',
          'Realized P/L': '5000.00',
          'Code': '',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('test-file-1')
      expect(result[1].id).toBe('test-file-2')
      expect(result[0].type).toBe(TransactionType.BUY)
      expect(result[1].type).toBe(TransactionType.SELL)
    })

    it('should skip rows with missing date or symbol', () => {
      const rows = [
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Header',
          'DataDiscriminator': 'DataDiscriminator',
          'Asset Category': 'Asset Category',
          'Currency': 'Currency',
          'Symbol': 'Symbol',
          'Date/Time': 'Date/Time',
          'Exchange': 'Exchange',
          'Quantity': 'Quantity',
          'T. Price': 'T. Price',
          'Proceeds': 'Proceeds',
          'Comm/Fee': 'Comm/Fee',
          'Basis': 'Basis',
          'Realized P/L': 'Realized P/L',
          'Code': 'Code',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'Trade',
          'Asset Category': 'Stocks',
          'Currency': 'USD',
          'Symbol': '',
          'Date/Time': '2024-03-15 10:30:42',
          'Exchange': 'NASDAQ',
          'Quantity': '100',
          'T. Price': '170.50',
          'Proceeds': '-17050.00',
          'Comm/Fee': '-1.00',
          'Basis': '',
          'Realized P/L': '',
          'Code': '',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(0)
    })

    it('should handle other sections in CSV without processing them', () => {
      const rows = [
        createIBRow({
          'Statement': 'Statement',
          'Header': 'Header',
          'Field Name': 'Field Name',
          'Field Value': 'Field Value',
        }),
        createIBRow({
          'Statement': 'Statement',
          'Header': 'Data',
          'Field Name': 'Period',
          'Field Value': 'January 2024',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Header',
          'DataDiscriminator': 'DataDiscriminator',
          'Asset Category': 'Asset Category',
          'Currency': 'Currency',
          'Symbol': 'Symbol',
          'Date/Time': 'Date/Time',
          'Exchange': 'Exchange',
          'Quantity': 'Quantity',
          'T. Price': 'T. Price',
          'Proceeds': 'Proceeds',
          'Comm/Fee': 'Comm/Fee',
          'Basis': 'Basis',
          'Realized P/L': 'Realized P/L',
          'Code': 'Code',
        }),
        createIBRow({
          'Trades': 'Trades',
          'Header': 'Data',
          'DataDiscriminator': 'Trade',
          'Asset Category': 'Stocks',
          'Currency': 'USD',
          'Symbol': 'AAPL',
          'Date/Time': '2024-03-15 10:30:42',
          'Exchange': 'NASDAQ',
          'Quantity': '100',
          'T. Price': '170.50',
          'Proceeds': '-17050.00',
          'Comm/Fee': '-1.00',
          'Basis': '',
          'Realized P/L': '',
          'Code': '',
        }),
        createIBRow({
          'Cash Transactions': 'Cash Transactions',
          'Header': 'Header',
          'Currency': 'Currency',
          'Symbol': 'Symbol',
          'Date/Time': 'Date/Time',
        }),
        createIBRow({
          'Cash Transactions': 'Cash Transactions',
          'Header': 'Data',
          'Currency': 'USD',
          'Symbol': 'AAPL',
          'Date/Time': '2024-03-20 00:00:00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1) // Only the Trades section trade
      expect(result[0].symbol).toBe('AAPL')
    })
  })
})
