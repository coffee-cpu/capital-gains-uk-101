import { describe, it, expect } from 'vitest'
import { isCoinbaseCSV, stripCoinbaseMetadataRows } from '../csvParser'

/**
 * Helper to read File content as text (works in jsdom test environment)
 */
async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

describe('csvParser', () => {
  describe('isCoinbaseCSV', () => {
    it('should return true for Coinbase CSV with Transactions and User lines', async () => {
      const csvContent = `Transactions,,,,,,,,,,
User,Jane_Doe,a1b2c3d4-5678-90ab-cdef-1234567890ab,,,,,,,,
ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
abc123,2025-01-01 10:00:00 UTC,Buy,BTC,0.1,GBP,£30000,£3000,£3000,£0,`
      const file = new File([csvContent], 'coinbase.csv', { type: 'text/csv' })

      const result = await isCoinbaseCSV(file)

      expect(result).toBe(true)
    })

    it('should return true for Coinbase CSV with leading blank line', async () => {
      const csvContent = `
Transactions
User,Ayush Lodha,23abed33-42ae-59cb-bfa9-5954455f34ff
ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
abc123,2025-01-01 10:00:00 UTC,Buy,BTC,0.1,GBP,£30000,£3000,£3000,£0,`
      const file = new File([csvContent], 'coinbase.csv', { type: 'text/csv' })

      const result = await isCoinbaseCSV(file)

      expect(result).toBe(true)
    })

    it('should return true for Coinbase CSV with multiple leading blank lines', async () => {
      const csvContent = `

Transactions,,,,
User,Test User,uuid-here
ID,Timestamp,Transaction Type,Asset
abc123,2025-01-01 10:00:00 UTC,Buy,BTC`
      const file = new File([csvContent], 'coinbase.csv', { type: 'text/csv' })

      const result = await isCoinbaseCSV(file)

      expect(result).toBe(true)
    })

    it('should return false for non-Coinbase CSV', async () => {
      const csvContent = `Date,Action,Symbol,Quantity,Price
2025-01-01,Buy,AAPL,10,150.00`
      const file = new File([csvContent], 'schwab.csv', { type: 'text/csv' })

      const result = await isCoinbaseCSV(file)

      expect(result).toBe(false)
    })

    it('should return false if first non-empty line is not Transactions', async () => {
      const csvContent = `User,Jane_Doe,uuid
Transactions,,,,
ID,Timestamp,Transaction Type,Asset`
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const result = await isCoinbaseCSV(file)

      expect(result).toBe(false)
    })

    it('should return false if second non-empty line is not User', async () => {
      const csvContent = `Transactions,,,,
ID,Timestamp,Transaction Type,Asset
abc123,2025-01-01,Buy,BTC`
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const result = await isCoinbaseCSV(file)

      expect(result).toBe(false)
    })

    it('should return false for empty file', async () => {
      const file = new File([''], 'empty.csv', { type: 'text/csv' })

      const result = await isCoinbaseCSV(file)

      expect(result).toBe(false)
    })
  })

  describe('stripCoinbaseMetadataRows', () => {
    it('should strip metadata rows and return file starting with headers', async () => {
      const csvContent = `Transactions,,,,,,,,,,
User,Jane_Doe,a1b2c3d4-5678-90ab-cdef-1234567890ab,,,,,,,,
ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
abc123,2025-01-01 10:00:00 UTC,Buy,BTC,0.1,GBP,£30000,£3000,£3000,£0,`
      const file = new File([csvContent], 'coinbase.csv', { type: 'text/csv' })

      const strippedFile = await stripCoinbaseMetadataRows(file)
      const text = await readFileAsText(strippedFile)

      expect(text.startsWith('ID,')).toBe(true)
      expect(text).not.toContain('Transactions')
      expect(text).not.toContain('User,Jane_Doe')
    })

    it('should handle file with leading blank line', async () => {
      const csvContent = `
Transactions
User,Ayush Lodha,uuid
ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
abc123,2025-01-01 10:00:00 UTC,Buy,BTC,0.1,GBP,£30000,£3000,£3000,£0,`
      const file = new File([csvContent], 'coinbase.csv', { type: 'text/csv' })

      const strippedFile = await stripCoinbaseMetadataRows(file)
      const text = await readFileAsText(strippedFile)

      expect(text.startsWith('ID,')).toBe(true)
    })

    it('should preserve file name and type', async () => {
      const csvContent = `Transactions
User,Test,uuid
ID,Timestamp,Transaction Type,Asset
abc,2025-01-01,Buy,BTC`
      const file = new File([csvContent], 'my-coinbase.csv', { type: 'text/csv' })

      const strippedFile = await stripCoinbaseMetadataRows(file)

      expect(strippedFile.name).toBe('my-coinbase.csv')
      expect(strippedFile.type).toBe('text/csv')
    })

    it('should preserve all data rows', async () => {
      const csvContent = `Transactions
User,Test,uuid
ID,Timestamp,Transaction Type,Asset
row1,2025-01-01,Buy,BTC
row2,2025-01-02,Sell,ETH
row3,2025-01-03,Staking Income,XTZ`
      const file = new File([csvContent], 'coinbase.csv', { type: 'text/csv' })

      const strippedFile = await stripCoinbaseMetadataRows(file)
      const text = await readFileAsText(strippedFile)
      const lines = text.split('\n').filter(l => l.trim())

      expect(lines).toHaveLength(4) // Header + 3 data rows
      expect(lines[0]).toContain('ID,')
      expect(lines[1]).toContain('row1')
      expect(lines[2]).toContain('row2')
      expect(lines[3]).toContain('row3')
    })

    it('should reject if headers row is not found', async () => {
      const csvContent = `Transactions
User,Test,uuid
Some,Other,Headers
data1,data2,data3`
      const file = new File([csvContent], 'bad.csv', { type: 'text/csv' })

      await expect(stripCoinbaseMetadataRows(file)).rejects.toThrow('Could not find Coinbase CSV headers')
    })
  })
})
