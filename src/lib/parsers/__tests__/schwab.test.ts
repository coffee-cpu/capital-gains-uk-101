import { describe, it, expect } from 'vitest'
import { normalizeSchwabTransactions, isOptionsSymbol, parseOptionsSymbol } from '../schwab'
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

    it('should emit NRA Tax Adj as TAX_ON_DIVIDEND and dividend with gross total', () => {
      const rows = [
        {
          'Date': '09/29/2024',
          'Action': 'Qualified Dividend',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '$25.00',  // Gross dividend
        },
        {
          'Date': '09/29/2024',
          'Action': 'NRA Tax Adj',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '-$3.75',  // Withholding tax
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      // Should produce TWO transactions (dividend + TAX, not merged)
      expect(result).toHaveLength(2)

      // Dividend keeps gross total
      expect(result[0].type).toBe(TransactionType.DIVIDEND)
      expect(result[0].symbol).toBe('AAPL')
      expect(result[0].grossDividend).toBe(25.00)
      expect(result[0].total).toBe(25.00)              // Gross, not net
      expect(result[0].withholdingTax).toBeUndefined()  // Schwab uses separate TAX_ON_DIVIDEND rows

      // NRA Tax Adj emitted as TAX_ON_DIVIDEND (has symbol)
      expect(result[1].type).toBe(TransactionType.TAX_ON_DIVIDEND)
      expect(result[1].symbol).toBe('AAPL')
      expect(result[1].total).toBe(3.75)               // Absolute value via calculateTotal
      expect(result[1].notes).toBe('NRA Tax Adj')
    })

    it('should handle dividend without NRA Tax Adj (no withholding)', () => {
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
      expect(result[0].grossDividend).toBe(15.75)
      expect(result[0].withholdingTax).toBeUndefined() // Schwab uses separate TAX_ON_DIVIDEND rows
      expect(result[0].total).toBe(15.75)
    })

    it('should emit multiple dividends and NRA Tax Adj as separate transactions', () => {
      const rows = [
        {
          'Date': '09/29/2024',
          'Action': 'Qualified Dividend',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '$25.00',
        },
        {
          'Date': '09/29/2024',
          'Action': 'NRA Tax Adj',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '-$3.75',
        },
        {
          'Date': '09/30/2024',
          'Action': 'Cash Dividend',
          'Symbol': 'MSFT',
          'Description': 'MICROSOFT CORP',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '$50.00',
        },
        {
          'Date': '09/30/2024',
          'Action': 'NRA Tax Adj',
          'Symbol': 'MSFT',
          'Description': 'MICROSOFT CORP',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '-$7.50',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      // Should produce 4 transactions (2 dividends + 2 TAX, not merged)
      expect(result).toHaveLength(4)

      // AAPL dividend (gross)
      const aaplDiv = result.find(tx => tx.type === TransactionType.DIVIDEND && tx.symbol === 'AAPL')!
      expect(aaplDiv.grossDividend).toBe(25.00)
      expect(aaplDiv.total).toBe(25.00)

      // AAPL NRA Tax Adj
      const aaplTax = result.find(tx => tx.type === TransactionType.TAX_ON_DIVIDEND && tx.symbol === 'AAPL')!
      expect(aaplTax.total).toBe(3.75)
      expect(aaplTax.notes).toBe('NRA Tax Adj')

      // MSFT dividend (gross)
      const msftDiv = result.find(tx => tx.type === TransactionType.DIVIDEND && tx.symbol === 'MSFT')!
      expect(msftDiv.grossDividend).toBe(50.00)
      expect(msftDiv.total).toBe(50.00)

      // MSFT NRA Tax Adj
      const msftTax = result.find(tx => tx.type === TransactionType.TAX_ON_DIVIDEND && tx.symbol === 'MSFT')!
      expect(msftTax.total).toBe(7.50)
      expect(msftTax.notes).toBe('NRA Tax Adj')
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

    it('should map unknown actions to UNKNOWN type', () => {
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
      expect(result[0].type).toBe(TransactionType.UNKNOWN)
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

    it('should handle Sell Short transactions as SELL', () => {
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
    })

    it('should handle Journal transactions as TRANSFER', () => {
      const rows = [
        {
          'Date': '02/10/2025',
          'Action': 'Journal',
          'Symbol': '',
          'Description': 'JOURNAL FRM ...612',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '$140000.00',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.TRANSFER)
      expect(result[0].total).toBe(140000.00)
    })

    it('should handle MoneyLink Transfer as TRANSFER', () => {
      const rows = [
        {
          'Date': '06/08/2023',
          'Action': 'MoneyLink Transfer',
          'Symbol': '',
          'Description': 'Tfr FIRST REPUBLIC BAN, N/A',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '$100.00',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.TRANSFER)
    })

    it('should handle Misc Cash Entry as FEE', () => {
      const rows = [
        {
          'Date': '06/02/2022',
          'Action': 'Misc Cash Entry',
          'Symbol': '',
          'Description': 'Sec Fee Adjustment',
          'Quantity': '',
          'Price': '',
          'Fees & Comm': '',
          'Amount': '$0.32',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(TransactionType.FEE)
    })

    it('should handle quantities with commas', () => {
      const rows = [
        {
          'Date': '10/07/2025',
          'Action': 'Buy',
          'Symbol': 'IREN',
          'Description': 'IREN LTD F',
          'Quantity': '1,000',
          'Price': '$59.4324',
          'Fees & Comm': '',
          'Amount': '-$59432.40',
        },
      ]

      const result = normalizeSchwabTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].quantity).toBe(1000)
    })

    // Options Trading Tests
    describe('Options Trading', () => {
      it('should normalize Buy to Open options transaction', () => {
        const rows = [
          {
            'Date': '11/10/2025',
            'Action': 'Buy to Open',
            'Symbol': 'CRWV 01/15/2027 110.00 C',
            'Description': 'CALL COREWEAVE INC $110 EXP 01/15/27',
            'Quantity': '3',
            'Price': '$41.00',
            'Fees & Comm': '$1.98',
            'Amount': '-$12301.98',
          },
        ]

        const result = normalizeSchwabTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe(TransactionType.OPTIONS_BUY_TO_OPEN)
        expect(result[0].symbol).toBe('CRWV 01/15/2027 110.00 C') // Full options symbol
        expect(result[0].underlying_symbol).toBe('CRWV')
        expect(result[0].option_type).toBe('CALL')
        expect(result[0].strike_price).toBe(110.00)
        expect(result[0].expiration_date).toBe('2027-01-15')
        expect(result[0].contract_size).toBe(100)
        expect(result[0].quantity).toBe(3)
        expect(result[0].price).toBe(41.00)
        expect(result[0].fee).toBe(1.98)
      })

      it('should normalize Sell to Open options transaction', () => {
        const rows = [
          {
            'Date': '10/23/2025',
            'Action': 'Sell to Open',
            'Symbol': 'APP 11/07/2025 600.00 C',
            'Description': 'CALL APPLOVIN CORP $600 EXP 11/07/25',
            'Quantity': '1',
            'Price': '$44.00',
            'Fees & Comm': '$0.66',
            'Amount': '$4399.34',
          },
        ]

        const result = normalizeSchwabTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe(TransactionType.OPTIONS_SELL_TO_OPEN)
        expect(result[0].symbol).toBe('APP 11/07/2025 600.00 C') // Full options symbol
        expect(result[0].underlying_symbol).toBe('APP')
        expect(result[0].option_type).toBe('CALL')
        expect(result[0].strike_price).toBe(600.00)
        expect(result[0].expiration_date).toBe('2025-11-07')
      })

      it('should normalize Buy to Close options transaction', () => {
        const rows = [
          {
            'Date': '06/20/2025',
            'Action': 'Buy to Close',
            'Symbol': 'GOOGL 06/20/2025 170.00 C',
            'Description': 'CALL ALPHABET INC $170 EXP 06/20/25',
            'Quantity': '5',
            'Price': '$0.01',
            'Fees & Comm': '$0.05',
            'Amount': '-$5.05',
          },
        ]

        const result = normalizeSchwabTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe(TransactionType.OPTIONS_BUY_TO_CLOSE)
        expect(result[0].symbol).toBe('GOOGL 06/20/2025 170.00 C') // Full options symbol
        expect(result[0].underlying_symbol).toBe('GOOGL')
        expect(result[0].strike_price).toBe(170.00)
      })

      it('should normalize Sell to Close options transaction', () => {
        const rows = [
          {
            'Date': '01/02/2026',
            'Action': 'Sell to Close',
            'Symbol': 'GOOGL 01/16/2026 160.00 C',
            'Description': 'CALL ALPHABET INC $160 EXP 01/16/26',
            'Quantity': '3',
            'Price': '$154.00',
            'Fees & Comm': '$1.99',
            'Amount': '$46198.01',
          },
        ]

        const result = normalizeSchwabTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe(TransactionType.OPTIONS_SELL_TO_CLOSE)
        expect(result[0].symbol).toBe('GOOGL 01/16/2026 160.00 C') // Full options symbol
        expect(result[0].underlying_symbol).toBe('GOOGL')
        expect(result[0].option_type).toBe('CALL')
        expect(result[0].strike_price).toBe(160.00)
        expect(result[0].expiration_date).toBe('2026-01-16')
      })

      it('should normalize Assigned options transaction with as of date', () => {
        const rows = [
          {
            'Date': '11/10/2025 as of 11/07/2025',
            'Action': 'Assigned',
            'Symbol': 'APP 11/07/2025 600.00 C',
            'Description': 'CALL APPLOVIN CORP $600 EXP 11/07/25',
            'Quantity': '1',
            'Price': '',
            'Fees & Comm': '',
            'Amount': '',
          },
        ]

        const result = normalizeSchwabTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe(TransactionType.OPTIONS_ASSIGNED)
        expect(result[0].date).toBe('2025-11-07') // Uses "as of" date
        expect(result[0].symbol).toBe('APP 11/07/2025 600.00 C') // Full options symbol
        expect(result[0].underlying_symbol).toBe('APP')
        expect(result[0].option_type).toBe('CALL')
        expect(result[0].strike_price).toBe(600.00)
      })

      it('should normalize Expired options transaction with as of date', () => {
        const rows = [
          {
            'Date': '09/22/2025 as of 09/19/2025',
            'Action': 'Expired',
            'Symbol': 'NVDA 09/19/2025 182.50 C',
            'Description': 'CALL NVIDIA CORP $182.5 EXP 09/19/25',
            'Quantity': '11',
            'Price': '',
            'Fees & Comm': '',
            'Amount': '',
          },
        ]

        const result = normalizeSchwabTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe(TransactionType.OPTIONS_EXPIRED)
        expect(result[0].date).toBe('2025-09-19') // Uses "as of" date
        expect(result[0].symbol).toBe('NVDA 09/19/2025 182.50 C') // Full options symbol
        expect(result[0].underlying_symbol).toBe('NVDA')
        expect(result[0].option_type).toBe('CALL')
        expect(result[0].strike_price).toBe(182.50)
      })

      it('should normalize PUT options correctly', () => {
        const rows = [
          {
            'Date': '07/10/2025',
            'Action': 'Sell to Open',
            'Symbol': 'APP 07/11/2025 340.00 P',
            'Description': 'PUT APPLOVIN CORP $340 EXP 07/11/25',
            'Quantity': '1',
            'Price': '$3.40',
            'Fees & Comm': '$0.66',
            'Amount': '$339.34',
          },
        ]

        const result = normalizeSchwabTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe(TransactionType.OPTIONS_SELL_TO_OPEN)
        expect(result[0].option_type).toBe('PUT')
        expect(result[0].strike_price).toBe(340.00)
      })

      it('should normalize Options Frwd Split transaction (negative quantity)', () => {
        const rows = [
          {
            'Date': '06/10/2024',
            'Action': 'Options Frwd Split',
            'Symbol': 'NVDA 06/07/2024 1100.00 P',
            'Description': 'PUT NVIDIA CORP $1100 EXP 06/07/24',
            'Quantity': '-9',
            'Price': '',
            'Fees & Comm': '',
            'Amount': '',
          },
        ]

        const result = normalizeSchwabTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe(TransactionType.OPTIONS_STOCK_SPLIT)
        expect(result[0].quantity).toBe(-9) // Negative quantity preserved
        expect(result[0].symbol).toBe('NVDA 06/07/2024 1100.00 P') // Full options symbol
        expect(result[0].underlying_symbol).toBe('NVDA')
        expect(result[0].option_type).toBe('PUT')
        expect(result[0].strike_price).toBe(1100.00)
      })

      it('should normalize Options Frwd Split Adj transaction (positive quantity with price)', () => {
        const rows = [
          {
            'Date': '06/10/2024 as of 06/07/2024',
            'Action': 'Options Frwd Split Adj',
            'Symbol': 'NVDA 06/07/2024 1100.00 P',
            'Description': 'PUT NVIDIA CORP $1100 EXP 06/07/24',
            'Quantity': '9',
            'Price': '$0.01',
            'Fees & Comm': '',
            'Amount': '',
          },
        ]

        const result = normalizeSchwabTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe(TransactionType.OPTIONS_STOCK_SPLIT)
        expect(result[0].date).toBe('2024-06-07') // Uses "as of" date
        expect(result[0].quantity).toBe(9)
        expect(result[0].price).toBe(0.01)
        expect(result[0].symbol).toBe('NVDA 06/07/2024 1100.00 P') // Full options symbol
        expect(result[0].underlying_symbol).toBe('NVDA')
      })
    })
  })

  describe('isOptionsSymbol', () => {
    it('should return true for valid CALL option symbol', () => {
      expect(isOptionsSymbol('GOOGL 01/16/2026 160.00 C')).toBe(true)
    })

    it('should return true for valid PUT option symbol', () => {
      expect(isOptionsSymbol('APP 02/28/2025 400.00 P')).toBe(true)
    })

    it('should return false for regular stock symbol', () => {
      expect(isOptionsSymbol('GOOGL')).toBe(false)
      expect(isOptionsSymbol('AAPL')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isOptionsSymbol('')).toBe(false)
    })

    it('should handle edge case strike prices', () => {
      expect(isOptionsSymbol('SPY 04/17/2025 540.00 P')).toBe(true)
      expect(isOptionsSymbol('NVDA 02/23/2024 1080.00 C')).toBe(true)
      expect(isOptionsSymbol('QCOM 06/27/2025 157.50 C')).toBe(true)
    })
  })

  describe('parseOptionsSymbol', () => {
    it('should parse CALL option symbol correctly', () => {
      const result = parseOptionsSymbol('GOOGL 01/16/2026 160.00 C')

      expect(result).not.toBeNull()
      expect(result!.underlying).toBe('GOOGL')
      expect(result!.expirationDate).toBe('2026-01-16')
      expect(result!.strikePrice).toBe(160.00)
      expect(result!.optionType).toBe('CALL')
    })

    it('should parse PUT option symbol correctly', () => {
      const result = parseOptionsSymbol('APP 02/28/2025 400.00 P')

      expect(result).not.toBeNull()
      expect(result!.underlying).toBe('APP')
      expect(result!.expirationDate).toBe('2025-02-28')
      expect(result!.strikePrice).toBe(400.00)
      expect(result!.optionType).toBe('PUT')
    })

    it('should handle decimal strike prices', () => {
      const result = parseOptionsSymbol('QCOM 06/27/2025 157.50 C')

      expect(result).not.toBeNull()
      expect(result!.strikePrice).toBe(157.50)
    })

    it('should handle high strike prices', () => {
      const result = parseOptionsSymbol('NVDA 02/23/2024 1080.00 C')

      expect(result).not.toBeNull()
      expect(result!.strikePrice).toBe(1080.00)
    })

    it('should return null for invalid symbol', () => {
      expect(parseOptionsSymbol('GOOGL')).toBeNull()
      expect(parseOptionsSymbol('')).toBeNull()
      expect(parseOptionsSymbol('invalid format')).toBeNull()
    })
  })
})
