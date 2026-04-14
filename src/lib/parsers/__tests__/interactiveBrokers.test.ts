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

      expect(result).toHaveLength(4) // Sorted by date: Withdrawal, Buy, Deposit, Adjustment (FEE)
      expect(result[0].type).toBe(TransactionType.TRANSFER)
      expect(result[0].notes).toBe('Withdrawal')
      expect(result[1].type).toBe(TransactionType.BUY)
      expect(result[1].symbol).toBe('VUSD')
      expect(result[2].type).toBe(TransactionType.TRANSFER)
      expect(result[2].notes).toBe('Deposit')
      expect(result[3].type).toBe(TransactionType.FEE)
      expect(result[3].notes).toBe('Adjustment')
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
      // Sorted by date: Sell (2022-05-11) before Buy (2024-09-27)
      expect(result[0].type).toBe(TransactionType.SELL)
      expect(result[1].type).toBe(TransactionType.BUY)
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

    it('should map Foreign Tax Withholding to TAX_ON_DIVIDEND', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2025-04-02',
          'Account': 'U1234567',
          'Description': 'VUSD withholding tax',
          'Transaction Type': 'Foreign Tax Withholding',
          'Symbol': 'VUSD',
          'Quantity': '-',
          'Price': '-',
          'Gross Amount ': '-3.67',
          'Commission': '-',
          'Net Amount': '-3.67',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: TransactionType.TAX_ON_DIVIDEND,
        symbol: 'VUSD',
        total: -3.67,
        notes: 'Foreign Tax Withholding',
      })
    })

    it('should map Foreign Tax Withholding with symbol="-" to CASH (not drop the row)', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2025-04-02',
          'Account': 'U1234567',
          'Description': 'Summary-level withholding',
          'Transaction Type': 'Foreign Tax Withholding',
          'Symbol': '-',
          'Quantity': '-',
          'Price': '-',
          'Gross Amount ': '-10.00',
          'Commission': '-',
          'Net Amount': '-10.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: TransactionType.TAX_ON_DIVIDEND,
        symbol: 'CASH',
        total: -10,
      })
    })

    it('should map Other Fee to FEE', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2025-01-15',
          'Account': 'U1234567',
          'Description': 'Monthly subscription fee',
          'Transaction Type': 'Other Fee',
          'Symbol': '-',
          'Quantity': '-',
          'Price': '-',
          'Gross Amount ': '-15.00',
          'Commission': '-',
          'Net Amount': '-15.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: TransactionType.FEE,
        symbol: 'CASH',
        total: -15,
        notes: 'Other Fee',
      })
    })

    it('should map Sales Tax to TAX', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2025-01-15',
          'Account': 'U1234567',
          'Description': 'VAT on subscription',
          'Transaction Type': 'Sales Tax',
          'Symbol': '-',
          'Quantity': '-',
          'Price': '-',
          'Gross Amount ': '-3.00',
          'Commission': '-',
          'Net Amount': '-3.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: TransactionType.TAX,
        symbol: 'CASH',
        total: -3,
        notes: 'Sales Tax',
      })
    })

    it('should map Forex Trade Component to TRANSFER', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2025-02-10',
          'Account': 'U1234567',
          'Description': 'FX conversion',
          'Transaction Type': 'Forex Trade Component',
          'Symbol': '-',
          'Quantity': '-',
          'Price': '-',
          'Gross Amount ': '500.00',
          'Commission': '-',
          'Net Amount': '500.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: TransactionType.TRANSFER,
        symbol: 'CASH',
        total: 500,
        notes: 'Forex Trade Component',
      })
    })
  })

  describe('Options symbol parsing', () => {
    it('should parse IB options symbol into underlying, strike, expiration, and type', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-01-15',
          'Account': 'U1234567',
          'Description': 'GLD Call',
          'Transaction Type': 'Buy',
          'Symbol': 'GLD   270115C00580000',
          'Quantity': '1',
          'Price': '5.00',
          'Gross Amount ': '-500.00',
          'Commission': '-1.00',
          'Net Amount': '-501.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file', '2025-01-01')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: TransactionType.OPTIONS_BUY_TO_OPEN,
        symbol: 'GLD   270115C00580000',
        underlying_symbol: 'GLD',
        option_type: 'CALL',
        strike_price: 580,
        expiration_date: '2027-01-15',
      })
    })

    it('should parse PUT options and divide strike price by 1000 correctly', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-06-10',
          'Account': 'U1234567',
          'Description': 'AAPL Put',
          'Transaction Type': 'Buy',
          'Symbol': 'AAPL  240920P00175500',
          'Quantity': '2',
          'Price': '1.25',
          'Gross Amount ': '-250.00',
          'Commission': '-1.00',
          'Net Amount': '-251.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file', '2023-01-01')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        option_type: 'PUT',
        strike_price: 175.5, // 00175500 / 1000
        expiration_date: '2024-09-20',
        underlying_symbol: 'AAPL',
      })
    })
  })

  describe('Options position tracking (buy-to-open vs buy-to-close)', () => {
    it('should classify a buy with no existing position as BUY_TO_OPEN', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-01-15',
          'Account': 'U1234567',
          'Transaction Type': 'Buy',
          'Symbol': 'GLD   270115C00580000',
          'Quantity': '1',
          'Gross Amount ': '-500.00',
          'Commission': '-1.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file', '2025-01-01')

      expect(result[0].type).toBe(TransactionType.OPTIONS_BUY_TO_OPEN)
    })

    it('should classify a buy covering a short position as BUY_TO_CLOSE', () => {
      const rows = [
        // First sell to open (short)
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-01-10',
          'Account': 'U1234567',
          'Transaction Type': 'Sell',
          'Symbol': 'GLD   270115C00580000',
          'Quantity': '-1',
          'Gross Amount ': '500.00',
          'Commission': '-1.00',
        }),
        // Later buy to close
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-01-15',
          'Account': 'U1234567',
          'Transaction Type': 'Buy',
          'Symbol': 'GLD   270115C00580000',
          'Quantity': '1',
          'Gross Amount ': '-300.00',
          'Commission': '-1.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file', '2025-01-01')

      expect(result).toHaveLength(2)
      expect(result[0].type).toBe(TransactionType.OPTIONS_SELL_TO_OPEN)
      expect(result[1].type).toBe(TransactionType.OPTIONS_BUY_TO_CLOSE)
    })

    it('should classify a sell against a long position as SELL_TO_CLOSE', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-01-10',
          'Account': 'U1234567',
          'Transaction Type': 'Buy',
          'Symbol': 'GLD   270115C00580000',
          'Quantity': '2',
          'Gross Amount ': '-1000.00',
          'Commission': '-1.00',
        }),
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-01-20',
          'Account': 'U1234567',
          'Transaction Type': 'Sell',
          'Symbol': 'GLD   270115C00580000',
          'Quantity': '-1',
          'Gross Amount ': '600.00',
          'Commission': '-1.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file', '2025-01-01')

      expect(result[0].type).toBe(TransactionType.OPTIONS_BUY_TO_OPEN)
      expect(result[1].type).toBe(TransactionType.OPTIONS_SELL_TO_CLOSE)
    })

    it('should classify Assignment as OPTIONS_ASSIGNED regardless of position', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-01-10',
          'Account': 'U1234567',
          'Transaction Type': 'Sell',
          'Symbol': 'GLD   240115C00580000',
          'Quantity': '-1',
          'Gross Amount ': '100.00',
          'Commission': '-1.00',
        }),
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-01-15',
          'Account': 'U1234567',
          'Transaction Type': 'Assignment',
          'Symbol': 'GLD   240115C00580000',
          'Quantity': '1',
          'Gross Amount ': '-580.00',
          'Commission': '-',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file', '2025-01-01')

      expect(result[1].type).toBe(TransactionType.OPTIONS_ASSIGNED)
    })

    it('should return null for options row with unparseable quantity (not misclassify as SELL)', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-01-10',
          'Account': 'U1234567',
          'Transaction Type': 'Buy',
          'Symbol': 'GLD   270115C00580000',
          'Quantity': '-',
          'Gross Amount ': '-500.00',
          'Commission': '-1.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file', '2025-01-01')

      expect(result).toHaveLength(0)
    })
  })

  describe('Synthetic OPTIONS_EXPIRED injection', () => {
    it('should inject OPTIONS_EXPIRED for long position with past expiration', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2023-06-01',
          'Account': 'U1234567',
          'Transaction Type': 'Buy',
          'Symbol': 'GLD   230915C00200000',
          'Quantity': '1',
          'Gross Amount ': '-100.00',
          'Commission': '-1.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file', '2024-01-01')

      expect(result).toHaveLength(2)
      const expired = result.find(t => t.type === TransactionType.OPTIONS_EXPIRED)
      expect(expired).toBeDefined()
      expect(expired).toMatchObject({
        date: '2023-09-15',
        quantity: -1, // negative qty for long position (disposal)
        price: 0,
        total: 0,
        underlying_symbol: 'GLD',
        option_type: 'CALL',
        strike_price: 200,
        expiration_date: '2023-09-15',
      })
    })

    it('should inject OPTIONS_EXPIRED with positive qty for short position past expiration', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2023-06-01',
          'Account': 'U1234567',
          'Transaction Type': 'Sell',
          'Symbol': 'GLD   230915C00200000',
          'Quantity': '-1',
          'Gross Amount ': '100.00',
          'Commission': '-1.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file', '2024-01-01')

      expect(result).toHaveLength(2)
      const expired = result.find(t => t.type === TransactionType.OPTIONS_EXPIRED)
      expect(expired).toMatchObject({
        quantity: 1, // positive qty for short position (acquisition to close out)
      })
    })

    it('should NOT inject OPTIONS_EXPIRED for positions fully closed before expiration', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2023-06-01',
          'Account': 'U1234567',
          'Transaction Type': 'Buy',
          'Symbol': 'GLD   230915C00200000',
          'Quantity': '1',
          'Gross Amount ': '-100.00',
          'Commission': '-1.00',
        }),
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2023-08-01',
          'Account': 'U1234567',
          'Transaction Type': 'Sell',
          'Symbol': 'GLD   230915C00200000',
          'Quantity': '-1',
          'Gross Amount ': '150.00',
          'Commission': '-1.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file', '2024-01-01')

      expect(result).toHaveLength(2)
      expect(result.some(t => t.type === TransactionType.OPTIONS_EXPIRED)).toBe(false)
    })

    it('should NOT inject OPTIONS_EXPIRED for positions with expiration in the future', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2024-06-01',
          'Account': 'U1234567',
          'Transaction Type': 'Buy',
          'Symbol': 'GLD   270915C00200000',
          'Quantity': '1',
          'Gross Amount ': '-100.00',
          'Commission': '-1.00',
        }),
      ]

      const result = normalizeInteractiveBrokersTransactions(rows, 'test-file', '2025-01-01')

      expect(result).toHaveLength(1)
      expect(result.some(t => t.type === TransactionType.OPTIONS_EXPIRED)).toBe(false)
    })

    it('should use the referenceDate parameter for deterministic expiration checks', () => {
      const rows = [
        createIBRow({
          'Section': 'Transaction History',
          'RowType': 'Data',
          'Date': '2023-06-01',
          'Account': 'U1234567',
          'Transaction Type': 'Buy',
          'Symbol': 'GLD   240115C00200000',
          'Quantity': '1',
          'Gross Amount ': '-100.00',
          'Commission': '-1.00',
        }),
      ]

      // Reference date before expiration — no synthetic row
      const beforeExp = normalizeInteractiveBrokersTransactions(rows, 'test-file', '2023-12-31')
      expect(beforeExp.some(t => t.type === TransactionType.OPTIONS_EXPIRED)).toBe(false)

      // Reference date after expiration — synthetic row injected
      const afterExp = normalizeInteractiveBrokersTransactions(rows, 'test-file', '2024-02-01')
      expect(afterExp.some(t => t.type === TransactionType.OPTIONS_EXPIRED)).toBe(true)
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
