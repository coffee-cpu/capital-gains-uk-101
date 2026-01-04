import { describe, it, expect } from 'vitest'
import { normalizeCoinbaseTransactions } from '../coinbase'
import type { RawCSVRow } from '../../../types/broker'

describe('Coinbase Parser', () => {
  describe('normalizeCoinbaseTransactions', () => {
    it('should parse Buy transactions correctly', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '5ddf7675189e05002d68d859',
          'Timestamp': '2019-11-28 07:25:41 UTC',
          'Transaction Type': 'Buy',
          'Asset': 'BTC',
          'Quantity Transacted': '0.06712949',
          'Price Currency': 'GBP',
          'Price at Transaction': '£5809.02831461',
          'Subtotal': '£389.95711',
          'Total (inclusive of fees and/or spread)': '£400.00',
          'Fees and/or Spread': '£10.0428918446712',
          'Notes': 'Bought 0.06712949 BTC for 400 GBP',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'test-file-1',
        source: 'Coinbase',
        date: '2019-11-28',
        type: 'BUY',
        symbol: 'BTC',
        quantity: 0.06712949,
        price: 5809.02831461,
        currency: 'GBP',
        total: 400.00,
        fee: 10.0428918446712,
        notes: 'Bought 0.06712949 BTC for 400 GBP',
      })
    })

    it('should parse Sell transactions correctly', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '5e5eefe3615b66001a632423',
          'Timestamp': '2020-03-04 00:01:39 UTC',
          'Transaction Type': 'Sell',
          'Asset': 'LINK',
          'Quantity Transacted': '-56.85864726',
          'Price Currency': 'GBP',
          'Price at Transaction': '£3.573535157265',
          'Subtotal': '£202.83',
          'Total (inclusive of fees and/or spread)': '£199.81',
          'Fees and/or Spread': '£3.02',
          'Notes': 'Sold 56.85864726 LINK for 199.81 GBP',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'SELL',
        symbol: 'LINK',
        quantity: 56.85864726, // Should be absolute value
        price: 3.573535157265,
        currency: 'GBP',
        total: 199.81,
        fee: 3.02,
      })
    })

    it('should parse Staking Income as INTEREST', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '6952c3c9654e3e136887d23d',
          'Timestamp': '2025-12-29 18:09:13 UTC',
          'Transaction Type': 'Staking Income',
          'Asset': 'ETH',
          'Quantity Transacted': '0.001490027',
          'Price Currency': 'GBP',
          'Price at Transaction': '£2174.346143449977341424',
          'Subtotal': '£3.23983',
          'Total (inclusive of fees and/or spread)': '£3.23983',
          'Fees and/or Spread': '£0.00',
          'Notes': '',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'INTEREST',
        symbol: 'ETH',
        quantity: 0.001490027,
        total: 3.23983,
        fee: 0,
      })
    })

    it('should parse Reward Income as INTEREST', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '69441821655b42abd196f00b',
          'Timestamp': '2025-12-18 15:05:05 UTC',
          'Transaction Type': 'Reward Income',
          'Asset': 'USDC',
          'Quantity Transacted': '0.270984',
          'Price Currency': 'GBP',
          'Price at Transaction': '£0.7455543304135473',
          'Subtotal': '£0.20203',
          'Total (inclusive of fees and/or spread)': '£0.20203',
          'Fees and/or Spread': '£0.00',
          'Notes': 'Received 0.270984 USDC from Coinbase Rewards',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'INTEREST',
        symbol: 'USDC',
        notes: 'Received 0.270984 USDC from Coinbase Rewards',
      })
    })

    it('should parse Send as TRANSFER', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '5f86d6acb2e71d0ca39ee627',
          'Timestamp': '2020-10-14 10:45:00 UTC',
          'Transaction Type': 'Send',
          'Asset': 'XRP',
          'Quantity Transacted': '-50',
          'Price Currency': 'GBP',
          'Price at Transaction': '£0.19418578335',
          'Subtotal': '-£9.70929',
          'Total (inclusive of fees and/or spread)': '-£9.70929',
          'Fees and/or Spread': '£0.00',
          'Notes': 'Sent 50 XRP to rw2ciyaNshpHe7bCHo4bRWq6pqqynnWKQg',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'TRANSFER',
        symbol: 'XRP',
        quantity: 50, // Should be absolute value
        total: 9.70929, // Should be absolute value
      })
    })

    it('should parse Receive as TRANSFER', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '5e613120142951150ba3199b',
          'Timestamp': '2020-03-05 17:04:32 UTC',
          'Transaction Type': 'Receive',
          'Asset': 'BSV',
          'Quantity Transacted': '0.00099536',
          'Price Currency': 'GBP',
          'Price at Transaction': '£189.70131600822286',
          'Subtotal': '£0.18882',
          'Total (inclusive of fees and/or spread)': '£0.18882',
          'Fees and/or Spread': '£0.00',
          'Notes': 'Received 0.00099536 BSV from an external account',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'TRANSFER',
        symbol: 'BSV',
        quantity: 0.00099536,
      })
    })

    it('should parse Deposit as TRANSFER', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '5e75286302eda1001bd88334',
          'Timestamp': '2020-03-20 20:32:35 UTC',
          'Transaction Type': 'Deposit',
          'Asset': 'GBP',
          'Quantity Transacted': '1000',
          'Price Currency': 'GBP',
          'Price at Transaction': '£1.00',
          'Subtotal': '£1000.00',
          'Total (inclusive of fees and/or spread)': '£1000.00',
          'Fees and/or Spread': '£0.00',
          'Notes': 'Deposit from UK Bank Account',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'TRANSFER',
        symbol: 'GBP',
        quantity: 1000,
        total: 1000,
      })
    })

    it('should parse Pro Deposit as TRANSFER', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '5f9df5cf02165107403f27ea',
          'Timestamp': '2020-10-31 23:39:59 UTC',
          'Transaction Type': 'Pro Deposit',
          'Asset': 'GBP',
          'Quantity Transacted': '-1500',
          'Price Currency': 'GBP',
          'Price at Transaction': '£1.00',
          'Subtotal': '-£1500.00',
          'Total (inclusive of fees and/or spread)': '-£1500.00',
          'Fees and/or Spread': '£0.00',
          'Notes': '',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'TRANSFER',
        symbol: 'GBP',
        quantity: 1500, // Absolute value
      })
    })

    it('should handle scientific notation in quantity', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '69550419e52ac26f4ad975c8',
          'Timestamp': '2025-12-31 11:08:09 UTC',
          'Transaction Type': 'Staking Income',
          'Asset': 'XTZ',
          'Quantity Transacted': '2.63622E-05',
          'Price Currency': 'GBP',
          'Price at Transaction': '£0.3742609628083752044',
          'Subtotal': '£0.00001',
          'Total (inclusive of fees and/or spread)': '£0.00001',
          'Fees and/or Spread': '£0.00',
          'Notes': '',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].quantity).toBeCloseTo(0.0000263622, 10)
    })

    it('should skip rows without essential data', () => {
      const rows: RawCSVRow[] = [
        {
          'Transactions': '', // Metadata row
        },
        {
          'User': 'xxxx', // Metadata row
        },
        {
          'ID': '123',
          'Timestamp': '2025-12-31 11:08:09 UTC',
          'Transaction Type': 'Buy',
          'Asset': 'BTC',
          'Quantity Transacted': '0.1',
          'Price Currency': 'GBP',
          'Price at Transaction': '£30000',
          'Subtotal': '£3000',
          'Total (inclusive of fees and/or spread)': '£3000',
          'Fees and/or Spread': '£0',
          'Notes': '',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].symbol).toBe('BTC')
    })

    it('should handle multiple transactions', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '1',
          'Timestamp': '2025-01-01 10:00:00 UTC',
          'Transaction Type': 'Buy',
          'Asset': 'BTC',
          'Quantity Transacted': '0.1',
          'Price Currency': 'GBP',
          'Price at Transaction': '£30000',
          'Subtotal': '£3000',
          'Total (inclusive of fees and/or spread)': '£3000',
          'Fees and/or Spread': '£0',
          'Notes': '',
        },
        {
          'ID': '2',
          'Timestamp': '2025-01-02 10:00:00 UTC',
          'Transaction Type': 'Buy',
          'Asset': 'ETH',
          'Quantity Transacted': '1',
          'Price Currency': 'GBP',
          'Price at Transaction': '£2000',
          'Subtotal': '£2000',
          'Total (inclusive of fees and/or spread)': '£2000',
          'Fees and/or Spread': '£0',
          'Notes': '',
        },
        {
          'ID': '3',
          'Timestamp': '2025-01-03 10:00:00 UTC',
          'Transaction Type': 'Sell',
          'Asset': 'BTC',
          'Quantity Transacted': '-0.05',
          'Price Currency': 'GBP',
          'Price at Transaction': '£32000',
          'Subtotal': '£1600',
          'Total (inclusive of fees and/or spread)': '£1590',
          'Fees and/or Spread': '£10',
          'Notes': '',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(3)
      expect(result[0].type).toBe('BUY')
      expect(result[0].symbol).toBe('BTC')
      expect(result[1].type).toBe('BUY')
      expect(result[1].symbol).toBe('ETH')
      expect(result[2].type).toBe('SELL')
      expect(result[2].symbol).toBe('BTC')
    })

    it('should generate unique IDs for each transaction', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '1',
          'Timestamp': '2025-01-01 10:00:00 UTC',
          'Transaction Type': 'Buy',
          'Asset': 'BTC',
          'Quantity Transacted': '0.1',
          'Price Currency': 'GBP',
          'Price at Transaction': '£30000',
          'Subtotal': '£3000',
          'Total (inclusive of fees and/or spread)': '£3000',
          'Fees and/or Spread': '£0',
          'Notes': '',
        },
        {
          'ID': '2',
          'Timestamp': '2025-01-02 10:00:00 UTC',
          'Transaction Type': 'Buy',
          'Asset': 'ETH',
          'Quantity Transacted': '1',
          'Price Currency': 'GBP',
          'Price at Transaction': '£2000',
          'Subtotal': '£2000',
          'Total (inclusive of fees and/or spread)': '£2000',
          'Fees and/or Spread': '£0',
          'Notes': '',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result[0].id).toBe('test-file-1')
      expect(result[1].id).toBe('test-file-2')
    })

    it('should default to GBP if currency is missing', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '1',
          'Timestamp': '2025-01-01 10:00:00 UTC',
          'Transaction Type': 'Buy',
          'Asset': 'BTC',
          'Quantity Transacted': '0.1',
          'Price Currency': '',
          'Price at Transaction': '£30000',
          'Subtotal': '£3000',
          'Total (inclusive of fees and/or spread)': '£3000',
          'Fees and/or Spread': '£0',
          'Notes': '',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result[0].currency).toBe('GBP')
    })

    it('should parse Advanced Trade Buy as BUY', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '1',
          'Timestamp': '2025-03-09 22:12:59 UTC',
          'Transaction Type': 'Advanced Trade Buy',
          'Asset': 'BTC',
          'Quantity Transacted': '0.035',
          'Price Currency': 'GBP',
          'Price at Transaction': '£63000.00',
          'Subtotal': '£2205.00',
          'Total (inclusive of fees and/or spread)': '£2218.23',
          'Fees and/or Spread': '£13.23',
          'Notes': 'Bought 0.035 BTC for 2218.23 GBP',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('BUY')
      expect(result[0].symbol).toBe('BTC')
    })

    it('should parse Advanced Trade Sell as SELL', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '1',
          'Timestamp': '2025-05-25 22:54:43 UTC',
          'Transaction Type': 'Advanced Trade Sell',
          'Asset': 'EOS',
          'Quantity Transacted': '-484.8',
          'Price Currency': 'GBP',
          'Price at Transaction': '£0.56',
          'Subtotal': '-£271.49',
          'Total (inclusive of fees and/or spread)': '-£269.86',
          'Fees and/or Spread': '£1.63',
          'Notes': 'Sold 484.8 EOS',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('SELL')
      expect(result[0].symbol).toBe('EOS')
      expect(result[0].quantity).toBe(484.8)
    })

    it('should parse Retail Staking Transfer as TRANSFER', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '1',
          'Timestamp': '2023-03-25 01:51:28 UTC',
          'Transaction Type': 'Retail Staking Transfer',
          'Asset': 'ADA',
          'Quantity Transacted': '1900.000000',
          'Price Currency': 'GBP',
          'Price at Transaction': '£0.29',
          'Subtotal': '£551.00',
          'Total (inclusive of fees and/or spread)': '£551.00',
          'Fees and/or Spread': '£0.00',
          'Notes': '',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('TRANSFER')
    })

    it('should parse Retail Eth2 Deprecation as TRANSFER', () => {
      const rows: RawCSVRow[] = [
        {
          'ID': '1',
          'Timestamp': '2025-01-21 19:58:23 UTC',
          'Transaction Type': 'Retail Eth2 Deprecation',
          'Asset': 'ETH',
          'Quantity Transacted': '15.64374695',
          'Price Currency': 'GBP',
          'Price at Transaction': '£2703.77',
          'Subtotal': '£42297.06',
          'Total (inclusive of fees and/or spread)': '£42297.06',
          'Fees and/or Spread': '£0.00',
          'Notes': '',
        },
      ]

      const result = normalizeCoinbaseTransactions(rows, 'test-file')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('TRANSFER')
    })
  })
})
