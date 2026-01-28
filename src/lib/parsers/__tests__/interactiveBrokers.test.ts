import { describe, it, expect } from 'vitest'
import { normalizeInteractiveBrokersTransactions } from '../interactiveBrokers'
import { TransactionType } from '../../../types/transaction'

// Helper to create IB CSV row format (after preprocessing by preprocessInteractiveBrokersCSV)
// Preprocessed format has columns: Section, RowType, Date, Account, Description, Transaction Type, Symbol, Quantity, Price, Gross Amount, Commission, Net Amount
const createIBRow = (data: {
  Section?: string;
  RowType?: string;
  Date?: string;
  Account?: string;
  Description?: string;
  'Transaction Type'?: string;
  Symbol?: string;
  Quantity?: string;
  Price?: string;
  'Gross Amount '?: string;
  Commission?: string;
  'Net Amount'?: string;
}) => data

describe('Interactive Brokers Parser', () => {
  describe('normalizeInteractiveBrokersTransactions', () => {
    it('should normalize a Buy transaction from Transaction History section', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-09-27',
          'Account': 'U1234567',
          'Description': 'VANG S&P500 USDD',
          'Transaction Type': 'Buy',
          'Symbol': 'VUSD',
          'Quantity': '100',
          'Price': '108.75',
          'Gross Amount ': '-8132.00',
          'Commission': '-4.49',
          'Net Amount': '-8136.49',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'test-file-1',
        source: 'Interactive Brokers',
        symbol: 'VUSD',
        date: '2024-09-27',
        type: TransactionType.BUY,
        quantity: 100,
        price: 81.32, // derived from gross amount / quantity (8132 / 100)
        currency: 'USD', // base currency (default)
        total: 8132.00,
        fee: 4.49,
      })
    })

    it('should normalize a Sell transaction (negative quantity)', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2022-05-11',
          'Account': 'U1234567',
          'Description': 'AMD',
          'Transaction Type': 'Sell',
          'Symbol': 'AMD',
          'Quantity': '-10.0',
          'Price': '100.00',
          'Gross Amount ': '1000.00',
          'Commission': '-1.00',
          'Net Amount': '999.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: TransactionType.SELL,
        symbol: 'AMD',
        quantity: 10, // Stored as positive
        price: 100, // derived from gross amount / quantity (1000 / 10)
        total: 1000,
        fee: 1,
      })
    })

    it('should handle various transaction types including transfers and unknown', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2025-06-02',
          'Account': 'U1234567',
          'Description': 'FX Translations P&L',
          'Transaction Type': 'Adjustment',
          'Symbol': '-',
          'Quantity': '-',
          'Price': '-',
          'Gross Amount ': '-593.38',
          'Commission': '-',
          'Net Amount': '-593.38',
        }),
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2025-03-22',
          'Account': 'U1234567',
          'Description': 'Electronic Fund Transfer',
          'Transaction Type': 'Deposit',
          'Symbol': '-',
          'Quantity': '-',
          'Price': '-',
          'Gross Amount ': '1000.0',
          'Commission': '-',
          'Net Amount': '1000.0',
        }),
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-01-15',
          'Account': 'U1234567',
          'Description': 'Disbursement Initiated by John Smith',
          'Transaction Type': 'Withdrawal',
          'Symbol': '-',
          'Quantity': '-',
          'Price': '-',
          'Gross Amount ': '-10000.0',
          'Commission': '-',
          'Net Amount': '-10000.0',
        }),
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-09-27',
          'Account': 'U1234567',
          'Description': 'VANG S&P500 USDD',
          'Transaction Type': 'Buy',
          'Symbol': 'VUSD',
          'Quantity': '100.0',
          'Price': '108.75',
          'Gross Amount ': '-8132.00',
          'Commission': '-4.49',
          'Net Amount': '-8136.49',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(4) // Adjustment (UNKNOWN), Deposit, Withdrawal, and Buy
      expect(result[0].type).toBe(TransactionType.UNKNOWN)
      expect(result[0].notes).toBe('Unrecognized transaction type: Adjustment')
      expect(result[1].type).toBe(TransactionType.TRANSFER)
      expect(result[1].notes).toBe('Deposit')
      expect(result[2].type).toBe(TransactionType.TRANSFER)
      expect(result[2].notes).toBe('Withdrawal')
      expect(result[3].type).toBe(TransactionType.BUY)
      expect(result[3].symbol).toBe('VUSD')
    })

    it('should parse dividend transactions', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2025-04-02',
          'Account': 'U1234567',
          'Description': 'VUSD(IE00B3XXRP09) Cash Dividend USD 0.32063 per Share (Mixed Income)',
          'Transaction Type': 'Dividend',
          'Symbol': 'VUSD',
          'Quantity': '-',
          'Price': '-',
          'Gross Amount ': '24.47',
          'Commission': '-',
          'Net Amount': '24.47',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: TransactionType.DIVIDEND,
        symbol: 'VUSD',
        total: 24.47,
        quantity: null,
        price: null,
      })
    })

    it('should parse credit interest transactions', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-10-03',
          'Account': 'U1234567',
          'Description': 'USD Credit Interest for Sep-2024',
          'Transaction Type': 'Credit Interest',
          'Symbol': '-',
          'Quantity': '-',
          'Price': '-',
          'Gross Amount ': '0.91',
          'Commission': '-',
          'Net Amount': '0.91',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: TransactionType.INTEREST,
        symbol: 'CASH',
        total: 0.91,
        notes: 'Credit Interest',
      })
    })

    it('should parse debit interest transactions with negative values', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2022-02-03',
          'Account': 'U1234567',
          'Description': 'USD Debit Interest for Jan-2022',
          'Transaction Type': 'Debit Interest',
          'Symbol': '-',
          'Quantity': '-',
          'Price': '-',
          'Gross Amount ': '-14.63',
          'Commission': '-',
          'Net Amount': '-14.63',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: TransactionType.INTEREST,
        symbol: 'CASH',
        total: -14.63, // Preserved as negative (money paid out)
        notes: 'Debit Interest',
      })
    })

    it('should skip bonds (symbols with fractions)', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2025-03-25',
          'Account': 'U1234567',
          'Description': 'UKT 0 5/8 06/07/25',
          'Transaction Type': 'Buy',
          'Symbol': 'UKT 0 5/8 06/07/25',
          'Quantity': '1000.0',
          'Price': '99.312',
          'Gross Amount ': '-993.12',
          'Commission': '-1.0',
          'Net Amount': '-994.12',
        }),
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-09-27',
          'Account': 'U1234567',
          'Description': 'VANG S&P500 USDD',
          'Transaction Type': 'Buy',
          'Symbol': 'VUSD',
          'Quantity': '100.0',
          'Price': '108.75',
          'Gross Amount ': '-8132.00',
          'Commission': '-4.49',
          'Net Amount': '-8136.49',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1) // Only the stock, not the bond
      expect(result[0].symbol).toBe('VUSD')
    })


    it('should extract base currency from Summary section', () => {
      const rows = [
        createIBRow({
          'Section': 'Summary',
          'RowType': 'Data',
          'Date': 'Base Currency', // Field Name is in Date column
          'Account': 'GBP', // Field Value is in Account column
        }),
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-09-27',
          'Account': 'U1234567',
          'Description': 'VANG S&P500 USDD',
          'Transaction Type': 'Buy',
          'Symbol': 'VUSD',
          'Quantity': '100.0',
          'Price': '108.75',
          'Gross Amount ': '-8132.00',
          'Commission': '-4.49',
          'Net Amount': '-8136.49',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].currency).toBe('GBP')
    })

    it('should always use base currency since Gross/Net are in base currency', () => {
      const rows = [
        createIBRow({
          'Section': 'Summary',
          'RowType': 'Data',
          'Date': 'Base Currency',
          'Account': 'GBP',
        }),
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-09-10',
          'Account': 'U1234567',
          'Description': 'Buy 100 shares of AAPL in USD',
          'Transaction Type': 'Buy',
          'Symbol': 'AAPL',
          'Quantity': '100.0',
          'Price': '150.00',
          'Gross Amount ': '-15000.00',
          'Commission': '-1.00',
          'Net Amount': '-15001.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].currency).toBe('GBP') // Always uses base currency since Gross/Net are in base currency
      expect(result[0].price).toBe(150) // derived from gross amount / quantity (15000 / 100)
    })

    it('should process multiple transactions with sequential IDs', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-09-27',
          'Account': 'U1234567',
          'Description': 'VANG S&P500 USDD',
          'Transaction Type': 'Buy',
          'Symbol': 'VUSD',
          'Quantity': '100.0',
          'Price': '81.32',
          'Gross Amount ': '-8132.00',
          'Commission': '-4.49',
          'Net Amount': '-8136.49',
        }),
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2022-05-11',
          'Account': 'U1234567',
          'Description': 'AMD',
          'Transaction Type': 'Sell',
          'Symbol': 'AMD',
          'Quantity': '-10.0',
          'Price': '100.00',
          'Gross Amount ': '1000.00',
          'Commission': '-1.00',
          'Net Amount': '999.00',
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
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '',
          'Account': 'U1234567',
          'Description': 'Missing date',
          'Transaction Type': 'Buy',
          'Symbol': 'AAPL',
          'Quantity': '100',
          'Price': '170.50',
          'Gross Amount ': '-17050.00',
          'Commission': '-1.00',
          'Net Amount': '-17051.00',
        }),
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-03-15',
          'Account': 'U1234567',
          'Description': 'Missing symbol',
          'Transaction Type': 'Buy',
          'Symbol': '',
          'Quantity': '100',
          'Price': '170.50',
          'Gross Amount ': '-17050.00',
          'Commission': '-1.00',
          'Net Amount': '-17051.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(0)
    })

    it('should handle other sections in CSV without processing them', () => {
      const rows = [
        createIBRow({
          'Section': 'Statement',
          'RowType': 'Data',
          'Date': 'Period',
          'Account': 'January 2024',
        }),
        createIBRow({
          'Section': 'Summary',
          'RowType': 'Data',
          'Date': 'Base Currency',
          'Account': 'GBP',
        }),
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-09-27',
          'Account': 'U1234567',
          'Description': 'VANG S&P500 USDD',
          'Transaction Type': 'Buy',
          'Symbol': 'VUSD',
          'Quantity': '100.0',
          'Price': '108.75',
          'Gross Amount ': '-8132.00',
          'Commission': '-4.49',
          'Net Amount': '-8136.49',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1) // Only the Transaction History row
      expect(result[0].symbol).toBe('VUSD')
      expect(result[0].currency).toBe('GBP') // Currency from Summary section
    })

    it('should skip symbols that are just dashes', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2025-03-22',
          'Account': 'U1234567',
          'Description': 'Electronic Fund Transfer',
          'Transaction Type': 'Buy', // Fake buy with no symbol
          'Symbol': '-',
          'Quantity': '100',
          'Price': '100',
          'Gross Amount ': '10000',
          'Commission': '-',
          'Net Amount': '10000',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(0) // "-" is not a valid symbol
    })
  })
})
