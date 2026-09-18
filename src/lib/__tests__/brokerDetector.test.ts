import { describe, it, expect } from 'vitest'
import { detectBroker } from '../brokerDetector'
import { BrokerType } from '../../types/broker'

describe('brokerDetector', () => {
  describe('detectBroker', () => {
    it('should detect Schwab format with high confidence', () => {
      const schwabRows = [
        {
          'Date': '09/29/2024',
          'Action': 'Buy',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '100',
          'Price': '150.00',
          'Fees & Comm': '$0.01',
          'Amount': '$15000.01',
        },
      ]

      const result = detectBroker(schwabRows)

      expect(result.broker).toBe(BrokerType.SCHWAB)
      expect(result.confidence).toBeGreaterThan(0.8)
      expect(result.headerMatches).toContain('Date')
      expect(result.headerMatches).toContain('Action')
      expect(result.headerMatches).toContain('Symbol')
    })

    it('should return unknown for empty rows', () => {
      const result = detectBroker([])

      expect(result.broker).toBe(BrokerType.UNKNOWN)
      expect(result.confidence).toBe(0)
      expect(result.headerMatches).toHaveLength(0)
    })

    it('should return unknown for unrecognized format', () => {
      const unknownRows = [
        {
          'Random': 'Value',
          'Unknown': 'Format',
        },
      ]

      const result = detectBroker(unknownRows)

      expect(result.broker).toBe(BrokerType.UNKNOWN)
      expect(result.confidence).toBe(0)
    })

    it('should detect Trading 212 format', () => {
      const trading212Rows = [
        {
          'Action': 'Market buy',
          'Time': '2024-01-15 10:30:00',
          'ISIN': 'US0378331005',
          'Ticker': 'AAPL',
          'No. of shares': '10',
        },
      ]

      const result = detectBroker(trading212Rows)

      expect(result.broker).toBe(BrokerType.TRADING212)
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    it('should detect Trading 212 format with the newer Time (UTC) header', () => {
      // Header row taken from a real newer-format export
      const trading212Rows = [
        {
          'Action': 'Market buy',
          'Time (UTC)': '2025-09-09 07:03:13+00:00',
          'ISIN': 'IE00BK5BQT80',
          'Ticker': 'VWRP',
          'Name': 'Vanguard FTSE All-World (Acc)',
          'Notes': '',
          'ID': 'EOF38462075394',
          'No. of shares': '42.2654268800',
          'Price / share': '118.3000000000',
          'Currency (Price / share)': 'GBP',
          'Exchange rate': '1.00000000',
          'Total': '5000.00',
          'Currency (Total)': 'GBP',
        },
      ]

      const result = detectBroker(trading212Rows)

      expect(result.broker).toBe(BrokerType.TRADING212)
      expect(result.confidence).toBeGreaterThan(0.8)
      expect(result.headerMatches).toContain('Action')
      expect(result.headerMatches).toContain('Time (UTC)')
      expect(result.headerMatches).toContain('Ticker')
    })

    it('should not detect a generic CSV without Trading 212 share/price columns as Trading 212', () => {
      const genericRows = [
        {
          'Action': 'Buy',
          'Time': '2025-01-15 10:30:00',
          'Ticker': 'AAPL',
          'Quantity': '10',
          'Total': '1500.00',
        },
      ]

      const result = detectBroker(genericRows)

      expect(result.broker).not.toBe(BrokerType.TRADING212)
      expect(result.confidence).toBeLessThan(0.8)
    })

    it('should prefer Schwab over Trading212 when Schwab has higher confidence', () => {
      const mixedRows = [
        {
          'Date': '09/29/2024',
          'Action': 'Buy',
          'Symbol': 'AAPL',
          'Description': 'APPLE INC',
          'Quantity': '100',
          'Price': '150.00',
          'Fees & Comm': '$0.01',
          'Amount': '$15000.01',
          'ISIN': 'US0378331005', // Also has ISIN
        },
      ]

      const result = detectBroker(mixedRows)

      expect(result.broker).toBe(BrokerType.SCHWAB)
    })

    it('should detect EquatePlus format with high confidence', () => {
      const equatePlusRows = [
        {
          'Order reference': 'TBPP230615001234',
          'Date': '15 Jun 2023',
          'Order type': 'Sell at market price',
          'Quantity': '1,200',
          'Status': 'Executed',
          'Execution price': '£5.25',
          'Instrument': 'BP Ordinary Shares',
          'Product type': 'shares',
        },
      ]

      const result = detectBroker(equatePlusRows)

      expect(result.broker).toBe(BrokerType.EQUATE_PLUS)
      expect(result.confidence).toBeGreaterThan(0.8)
      expect(result.headerMatches).toContain('Order reference')
      expect(result.headerMatches).toContain('Date')
      expect(result.headerMatches).toContain('Order type')
      expect(result.headerMatches).toContain('Instrument')
    })

    it('should detect Revolut format with high confidence', () => {
      const revolutRows = [
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

      const result = detectBroker(revolutRows)

      expect(result.broker).toBe(BrokerType.REVOLUT)
      expect(result.confidence).toBeGreaterThan(0.8)
      expect(result.headerMatches).toContain('Date')
      expect(result.headerMatches).toContain('Ticker')
      expect(result.headerMatches).toContain('Type')
      expect(result.headerMatches).toContain('Price per share')
      expect(result.headerMatches).toContain('Total Amount')
      expect(result.headerMatches).toContain('Currency')
      expect(result.headerMatches).toContain('FX Rate')
    })
  })
})
