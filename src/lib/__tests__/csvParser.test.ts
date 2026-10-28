import { describe, it, expect } from 'vitest'
import { isCoinbaseCSV, stripCoinbaseMetadataRows } from '../parsers/coinbase'

describe('csvParser', () => {
  describe('isCoinbaseCSV', () => {
    it('should return true for Coinbase CSV with Transactions and User lines', () => {
      const csvContent = `Transactions,,,,,,,,,,
User,Jane_Doe,a1b2c3d4-5678-90ab-cdef-1234567890ab,,,,,,,,
ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
abc123,2025-01-01 10:00:00 UTC,Buy,BTC,0.1,GBP,£30000,£3000,£3000,£0,`

      const result = isCoinbaseCSV(csvContent)

      expect(result).toBe(true)
    })

    it('should return true for Coinbase CSV with leading blank line', () => {
      const csvContent = `
Transactions
User,Ayush Lodha,23abed33-42ae-59cb-bfa9-5954455f34ff
ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
abc123,2025-01-01 10:00:00 UTC,Buy,BTC,0.1,GBP,£30000,£3000,£3000,£0,`

      const result = isCoinbaseCSV(csvContent)

      expect(result).toBe(true)
    })

    it('should return true for Coinbase CSV with multiple leading blank lines', () => {
      const csvContent = `

Transactions,,,,
User,Test User,uuid-here
ID,Timestamp,Transaction Type,Asset
abc123,2025-01-01 10:00:00 UTC,Buy,BTC`

      const result = isCoinbaseCSV(csvContent)

      expect(result).toBe(true)
    })

    it('should return false for non-Coinbase CSV', () => {
      const csvContent = `Date,Action,Symbol,Quantity,Price
2025-01-01,Buy,AAPL,10,150.00`

      const result = isCoinbaseCSV(csvContent)

      expect(result).toBe(false)
    })

    it('should return false if first non-empty line is not Transactions', () => {
      const csvContent = `User,Jane_Doe,uuid
Transactions,,,,
ID,Timestamp,Transaction Type,Asset`

      const result = isCoinbaseCSV(csvContent)

      expect(result).toBe(false)
    })

    it('should return false if second non-empty line is not User', () => {
      const csvContent = `Transactions,,,,
ID,Timestamp,Transaction Type,Asset
abc123,2025-01-01,Buy,BTC`

      const result = isCoinbaseCSV(csvContent)

      expect(result).toBe(false)
    })

    it('should return false for empty file', () => {
      const csvContent = ''

      const result = isCoinbaseCSV(csvContent)

      expect(result).toBe(false)
    })
  })

  describe('stripCoinbaseMetadataRows', () => {
    it('should strip metadata rows and return text starting with headers', () => {
      const csvContent = `Transactions,,,,,,,,,,
User,Jane_Doe,a1b2c3d4-5678-90ab-cdef-1234567890ab,,,,,,,,
ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
abc123,2025-01-01 10:00:00 UTC,Buy,BTC,0.1,GBP,£30000,£3000,£3000,£0,`

      const text = stripCoinbaseMetadataRows(csvContent)

      expect(text.startsWith('ID,')).toBe(true)
      expect(text).not.toContain('Transactions')
      expect(text).not.toContain('User,Jane_Doe')
    })

    it('should handle content with leading blank line', () => {
      const csvContent = `
Transactions
User,Ayush Lodha,uuid
ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
abc123,2025-01-01 10:00:00 UTC,Buy,BTC,0.1,GBP,£30000,£3000,£3000,£0,`

      const text = stripCoinbaseMetadataRows(csvContent)

      expect(text.startsWith('ID,')).toBe(true)
    })

    it('should preserve all data rows', () => {
      const csvContent = `Transactions
User,Test,uuid
ID,Timestamp,Transaction Type,Asset
row1,2025-01-01,Buy,BTC
row2,2025-01-02,Sell,ETH
row3,2025-01-03,Staking Income,XTZ`

      const text = stripCoinbaseMetadataRows(csvContent)
      const lines = text.split('\n').filter(l => l.trim())

      expect(lines).toHaveLength(4) // Header + 3 data rows
      expect(lines[0]).toContain('ID,')
      expect(lines[1]).toContain('row1')
      expect(lines[2]).toContain('row2')
      expect(lines[3]).toContain('row3')
    })

    it('should throw if headers row is not found', () => {
      const csvContent = `Transactions
User,Test,uuid
Some,Other,Headers
data1,data2,data3`

      expect(() => stripCoinbaseMetadataRows(csvContent)).toThrow('Could not find Coinbase CSV headers')
    })
  })
})
