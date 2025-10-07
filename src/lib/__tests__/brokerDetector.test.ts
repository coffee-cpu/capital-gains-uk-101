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
  })
})
