import { describe, it, expect } from 'vitest'
import { normalizeTrading212Transactions } from '../trading212'
import { TransactionType } from '../../../types/transaction'

describe('Trading 212 Parser', () => {
  describe('normalizeTrading212Transactions', () => {
    it('should normalize a Market buy transaction', () => {
      const rows = [
        {
          'Action': 'Market buy',
          'Time': '2025-09-09 07:03:13',
          'ISIN': 'IE00BK5BQT80',
          'Ticker': 'VWRP',
          'Name': 'Vanguard FTSE All-World (Acc)',
          'No. of shares': '42.2654268800',
          'Price / share': '118.3000000000',
          'Currency (Price / share)': 'GBP',
          'Exchange rate': '1.00000000',
          'Currency (Result)': 'GBP',
          'Total': '5000.00',
          'Currency (Total)': 'GBP',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '',
          'Currency (Transaction fee)': '',
          'Currency conversion fee': '',
          'Currency (Currency conversion fee)': '',
          'Notes': '',
          'ID': 'EOF38462075394',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'test-file-1',
        source: 'Trading 212',
        symbol: 'VWRP',
        name: 'Vanguard FTSE All-World (Acc)',
        date: '2025-09-09',
        type: TransactionType.BUY,
        quantity: 42.2654268800,
        price: 118.30,
        currency: 'GBP',
        total: 42.2654268800 * 118.30, // Calculated from price × quantity
      })
    })

    it('should normalize a Limit sell transaction', () => {
      const rows = [
        {
          'Action': 'Limit sell',
          'Time': '2025-09-15 14:30:00',
          'ISIN': 'US0378331005',
          'Ticker': 'AAPL',
          'Name': 'Apple Inc.',
          'No. of shares': '10.00',
          'Price / share': '175.50',
          'Currency (Price / share)': 'USD',
          'Exchange rate': '0.77',
          'Currency (Result)': 'GBP',
          'Total': '1351.35',
          'Currency (Total)': 'GBP',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '0.50',
          'Currency (Transaction fee)': 'GBP',
          'Currency conversion fee': '0.15',
          'Currency (Currency conversion fee)': 'GBP',
          'Notes': '',
          'ID': 'TEST123',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.SELL)
      expect(result[0].quantity).toBe(10)
      expect(result[0].price).toBe(175.50)
      expect(result[0].currency).toBe('USD') // Price currency, not result currency
      expect(result[0].total).toBe(1755.00) // 10 × 175.50 in USD
      expect(result[0].fee).toBe(0.65) // 0.50 + 0.15
    })

    it('should normalize dividend transactions', () => {
      const rows = [
        {
          'Action': 'Dividend',
          'Time': '2025-09-20 10:00:00',
          'ISIN': 'US0378331005',
          'Ticker': 'AAPL',
          'Name': 'Apple Inc.',
          'No. of shares': '',
          'Price / share': '',
          'Currency (Price / share)': '',
          'Exchange rate': '0.77',
          'Currency (Result)': 'GBP',
          'Total': '15.75',
          'Currency (Total)': 'GBP',
          'Withholding tax': '2.36',
          'Currency (Withholding tax)': 'GBP',
          'Transaction fee': '',
          'Currency (Transaction fee)': '',
          'Currency conversion fee': '',
          'Currency (Currency conversion fee)': '',
          'Notes': '',
          'ID': 'DIV123',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.DIVIDEND)
      expect(result[0].quantity).toBeNull()
      expect(result[0].price).toBeNull()
      expect(result[0].total).toBe(15.75) // Uses CSV total for dividends (net amount)
      // SA106 fields: grossDividend = net + withholding, withholdingTax = tax withheld
      expect(result[0].grossDividend).toBe(18.11) // 15.75 + 2.36
      expect(result[0].withholdingTax).toBe(2.36)
      expect(result[0].notes).toContain('Gross: 18.11 GBP')
      expect(result[0].notes).toContain('Tax withheld: 2.36 GBP')
    })

    it('should normalize deposit transactions', () => {
      const rows = [
        {
          'Action': 'Deposit',
          'Time': '2025-09-08 22:11:02',
          'ISIN': '',
          'Ticker': '',
          'Name': '',
          'No. of shares': '',
          'Price / share': '',
          'Currency (Price / share)': '',
          'Exchange rate': '',
          'Currency (Result)': 'GBP',
          'Total': '5000.00',
          'Currency (Total)': 'GBP',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '',
          'Currency (Transaction fee)': '',
          'Currency conversion fee': '',
          'Currency (Currency conversion fee)': '',
          'Notes': 'Transaction ID: e980e691-68e6-4b3a-96c0-5c3eb860cf66',
          'ID': '49c5d111-d61c-447c-895c-f2bf602d61ec',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.TRANSFER)
      expect(result[0].symbol).toBe('')
      expect(result[0].total).toBe(5000.00) // Uses CSV total for deposits
      expect(result[0].currency).toBe('GBP')
      expect(result[0].notes).toContain('Transaction ID:')
    })

    it('should normalize interest on cash transactions', () => {
      const rows = [
        {
          'Action': 'Interest on cash',
          'Time': '2025-09-30 23:59:59',
          'ISIN': '',
          'Ticker': '',
          'Name': '',
          'No. of shares': '',
          'Price / share': '',
          'Currency (Price / share)': '',
          'Exchange rate': '',
          'Currency (Result)': 'GBP',
          'Total': '1.25',
          'Currency (Total)': 'GBP',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '',
          'Currency (Transaction fee)': '',
          'Currency conversion fee': '',
          'Currency (Currency conversion fee)': '',
          'Notes': '',
          'ID': 'INT123',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.INTEREST)
      expect(result[0].total).toBe(1.25) // Uses CSV total for interest
      expect(result[0].currency).toBe('GBP')
    })

    it('should handle empty rows correctly', () => {
      const rows = [
        {
          'Action': '',
          'Time': '',
          'ISIN': '',
          'Ticker': '',
          'Name': '',
          'No. of shares': '',
          'Price / share': '',
          'Currency (Price / share)': '',
          'Exchange rate': '',
          'Currency (Result)': '',
          'Total': '',
          'Currency (Total)': '',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '',
          'Currency (Transaction fee)': '',
          'Currency conversion fee': '',
          'Currency (Currency conversion fee)': '',
          'Notes': '',
          'ID': '',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(0)
    })

    it('should process multiple transactions with sequential IDs', () => {
      const rows = [
        {
          'Action': 'Market buy',
          'Time': '2025-09-09 07:03:13',
          'ISIN': 'IE00BK5BQT80',
          'Ticker': 'VWRP',
          'Name': 'Vanguard FTSE All-World (Acc)',
          'No. of shares': '42.27',
          'Price / share': '118.30',
          'Currency (Price / share)': 'GBP',
          'Exchange rate': '1.00',
          'Currency (Result)': 'GBP',
          'Total': '5000.00',
          'Currency (Total)': 'GBP',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '',
          'Currency (Transaction fee)': '',
          'Currency conversion fee': '',
          'Currency (Currency conversion fee)': '',
          'Notes': '',
          'ID': 'TX1',
        },
        {
          'Action': 'Market buy',
          'Time': '2025-09-30 07:00:34',
          'ISIN': 'IE00BK5BQT80',
          'Ticker': 'VWRP',
          'Name': 'Vanguard FTSE All-World (Acc)',
          'No. of shares': '82.09',
          'Price / share': '121.82',
          'Currency (Price / share)': 'GBP',
          'Exchange rate': '1.00',
          'Currency (Result)': 'GBP',
          'Total': '10000.00',
          'Currency (Total)': 'GBP',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '',
          'Currency (Transaction fee)': '',
          'Currency conversion fee': '',
          'Currency (Currency conversion fee)': '',
          'Notes': '',
          'ID': 'TX2',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('test-file-1')
      expect(result[1].id).toBe('test-file-2')
    })

    it('should handle transactions with only transaction fee', () => {
      const rows = [
        {
          'Action': 'Market sell',
          'Time': '2025-09-15 14:30:00',
          'ISIN': 'US0378331005',
          'Ticker': 'AAPL',
          'Name': 'Apple Inc.',
          'No. of shares': '5.00',
          'Price / share': '175.00',
          'Currency (Price / share)': 'USD',
          'Exchange rate': '0.77',
          'Currency (Result)': 'GBP',
          'Total': '673.75',
          'Currency (Total)': 'GBP',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '0.50',
          'Currency (Transaction fee)': 'GBP',
          'Currency conversion fee': '',
          'Currency (Currency conversion fee)': '',
          'Notes': '',
          'ID': 'SELL1',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].fee).toBe(0.50)
    })

    it('should handle transactions with only currency conversion fee', () => {
      const rows = [
        {
          'Action': 'Market buy',
          'Time': '2025-09-15 14:30:00',
          'ISIN': 'US0378331005',
          'Ticker': 'AAPL',
          'Name': 'Apple Inc.',
          'No. of shares': '5.00',
          'Price / share': '175.00',
          'Currency (Price / share)': 'USD',
          'Exchange rate': '0.77',
          'Currency (Result)': 'GBP',
          'Total': '673.75',
          'Currency (Total)': 'GBP',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '',
          'Currency (Transaction fee)': '',
          'Currency conversion fee': '0.15',
          'Currency (Currency conversion fee)': 'GBP',
          'Notes': '',
          'ID': 'BUY1',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].fee).toBe(0.15)
    })

    it('should handle Stop buy transactions', () => {
      const rows = [
        {
          'Action': 'Stop buy',
          'Time': '2024-03-01 09:00:00',
          'ISIN': 'US0378331005',
          'Ticker': 'AAPL',
          'Name': 'Apple Inc.',
          'No. of shares': '5.00',
          'Price / share': '170.00',
          'Currency (Price / share)': 'USD',
          'Exchange rate': '0.79',
          'Currency (Result)': 'GBP',
          'Total': '673.75',
          'Currency (Total)': 'GBP',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '',
          'Currency (Transaction fee)': '',
          'Currency conversion fee': '',
          'Currency (Currency conversion fee)': '',
          'Notes': '',
          'ID': 'STOP1',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.BUY)
      expect(result[0].currency).toBe('USD')
    })

    it('should handle dividend with parentheses in action name', () => {
      const rows = [
        {
          'Action': 'Dividend (Ordinary)',
          'Time': '2024-03-15 08:00:00',
          'ISIN': 'US0378331005',
          'Ticker': 'AAPL',
          'Name': 'Apple Inc.',
          'No. of shares': '',
          'Price / share': '',
          'Currency (Price / share)': '',
          'Exchange rate': '0.77',
          'Currency (Result)': 'GBP',
          'Total': '18.50',
          'Currency (Total)': 'GBP',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '',
          'Currency (Transaction fee)': '',
          'Currency conversion fee': '',
          'Currency (Currency conversion fee)': '',
          'Notes': '',
          'ID': 'DIV-ORD',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.DIVIDEND)
      expect(result[0].total).toBe(18.50)
    })

    it('should handle Lending interest', () => {
      const rows = [
        {
          'Action': 'Lending interest',
          'Time': '2024-03-31 23:59:59',
          'ISIN': '',
          'Ticker': '',
          'Name': '',
          'No. of shares': '',
          'Price / share': '',
          'Currency (Price / share)': '',
          'Exchange rate': '',
          'Currency (Result)': 'GBP',
          'Total': '0.50',
          'Currency (Total)': 'GBP',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '',
          'Currency (Transaction fee)': '',
          'Currency conversion fee': '',
          'Currency (Currency conversion fee)': '',
          'Notes': '',
          'ID': 'LEND-INT',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.INTEREST)
    })

    it('should handle Stock split as STOCK_SPLIT type', () => {
      const rows = [
        {
          'Action': 'Stock Split',
          'Time': '2024-04-01 09:00:00',
          'ISIN': 'US0378331005',
          'Ticker': 'AAPL',
          'Name': 'Apple Inc.',
          'No. of shares': '10.00',
          'Price / share': '',
          'Currency (Price / share)': '',
          'Exchange rate': '',
          'Currency (Result)': 'GBP',
          'Total': '',
          'Currency (Total)': 'GBP',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '',
          'Currency (Transaction fee)': '',
          'Currency conversion fee': '',
          'Currency (Currency conversion fee)': '',
          'Notes': '2-for-1 split',
          'ID': 'SPLIT1',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.STOCK_SPLIT)
      expect(result[0].notes).toContain('2-for-1 split')
    })

    it('should handle Result adjustment as FEE type', () => {
      const rows = [
        {
          'Action': 'Result adjustment',
          'Time': '2024-04-15 10:00:00',
          'ISIN': 'US0378331005',
          'Ticker': 'AAPL',
          'Name': 'Apple Inc.',
          'No. of shares': '',
          'Price / share': '',
          'Currency (Price / share)': '',
          'Exchange rate': '',
          'Currency (Result)': 'GBP',
          'Total': '5.00',
          'Currency (Total)': 'GBP',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '',
          'Currency (Transaction fee)': '',
          'Currency conversion fee': '',
          'Currency (Currency conversion fee)': '',
          'Notes': 'Tax adjustment',
          'ID': 'ADJ1',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.FEE)
    })

    it('should default to GBP if no currency is specified', () => {
      const rows = [
        {
          'Action': 'Deposit',
          'Time': '2025-09-08 22:11:02',
          'ISIN': '',
          'Ticker': '',
          'Name': '',
          'No. of shares': '',
          'Price / share': '',
          'Currency (Price / share)': '',
          'Exchange rate': '',
          'Currency (Result)': '',
          'Total': '5000.00',
          'Currency (Total)': '',
          'Withholding tax': '',
          'Currency (Withholding tax)': '',
          'Transaction fee': '',
          'Currency (Transaction fee)': '',
          'Currency conversion fee': '',
          'Currency (Currency conversion fee)': '',
          'Notes': '',
          'ID': 'DEP1',
        },
      ]

      const result = normalizeTrading212Transactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].currency).toBe('GBP')
    })
  })
})
