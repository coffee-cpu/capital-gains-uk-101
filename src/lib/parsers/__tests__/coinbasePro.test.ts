import { describe, it, expect } from 'vitest'
import { normalizeCoinbaseProTransactions } from '../coinbasePro'
import type { RawCSVRow } from '../../../types/broker'

describe('Coinbase Pro Parser', () => {
  describe('normalizeCoinbaseProTransactions', () => {
    describe('Fiat pairs (XRP-GBP, BTC-GBP, ETH-GBP)', () => {
      it('should parse BUY transactions correctly', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '191723',
            'product': 'XRP-GBP',
            'side': 'BUY',
            'created at': '2020-10-14T10:42:20.072Z',
            'size': '1008.74935600',
            'size unit': 'XRP',
            'price': '0.1943',
            'fee': '0.979999999354',
            'total': '-196.979999870154',
            'price/fee/total unit': 'GBP',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
          id: 'test-file-1',
          source: 'Coinbase Pro',
          date: '2020-10-14',
          type: 'BUY',
          symbol: 'XRP',
          quantity: 1008.74935600,
          price: 0.1943,
          currency: 'GBP',
          total: 196.979999870154, // Absolute value
          fee: 0.979999999354,
        })
        expect(result[0].notes).toContain('Trade ID: 191723')
      })

      it('should parse SELL transactions correctly', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '1244802',
            'product': 'ETH-GBP',
            'side': 'SELL',
            'created at': '2020-03-24T00:21:02.109Z',
            'size': '3.00000000',
            'size unit': 'ETH',
            'price': '118',
            'fee': '1.77',
            'total': '352.23',
            'price/fee/total unit': 'GBP',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
          type: 'SELL',
          symbol: 'ETH',
          quantity: 3.0,
          price: 118,
          currency: 'GBP',
          total: 352.23,
          fee: 1.77,
        })
      })

      it('should handle BTC-GBP trades', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '10562396',
            'product': 'BTC-GBP',
            'side': 'BUY',
            'created at': '2020-10-12T01:22:14.787Z',
            'size': '0.05382043',
            'size unit': 'BTC',
            'price': '8723.09',
            'fee': '2.3474022736435',
            'total': '-471.8278570023435',
            'price/fee/total unit': 'GBP',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
          type: 'BUY',
          symbol: 'BTC',
          quantity: 0.05382043,
          price: 8723.09,
          currency: 'GBP',
          total: 471.8278570023435,
        })
      })
    })

    describe('Crypto-to-crypto pairs (LINK-ETH)', () => {
      it('should generate TWO transactions for BUY (SELL quote + BUY base)', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '248602',
            'product': 'LINK-ETH',
            'side': 'BUY',
            'created at': '2020-03-08T02:07:38.824Z',
            'size': '28.23000000',
            'size unit': 'LINK',
            'price': '0.01834',
            'fee': '0.002588691',
            'total': '-0.520326891',
            'price/fee/total unit': 'ETH',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        // Should generate 2 transactions: SELL ETH + BUY LINK
        expect(result).toHaveLength(2)

        // First: SELL of ETH (quote currency being spent)
        expect(result[0]).toMatchObject({
          id: 'test-file-1',
          type: 'SELL',
          symbol: 'ETH',
          quantity: 0.520326891, // Amount of ETH spent
          currency: 'ETH', // No gbp_value provided, so currency is ETH
        })
        expect(result[0].notes).toContain('[Crypto-to-Crypto Disposal]')
        expect(result[0].notes).toContain('Trade ID: 248602')
        expect(result[0].notes).toContain('gbp_value')

        // Second: BUY of LINK (base currency being acquired)
        expect(result[1]).toMatchObject({
          id: 'test-file-2',
          type: 'BUY',
          symbol: 'LINK',
          quantity: 28.23, // Amount of LINK acquired
          price: 0.01834, // Price in ETH
          fee: 0, // Fee already on SELL
        })
        expect(result[1].notes).toContain('[Crypto-to-Crypto Acquisition]')
      })

      it('should generate TWO transactions for SELL (SELL base + BUY quote)', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '299085',
            'product': 'LINK-ETH',
            'side': 'SELL',
            'created at': '2020-03-24T10:01:33.766Z',
            'size': '60.00000000',
            'size unit': 'LINK',
            'price': '0.01668',
            'fee': '0.005004',
            'total': '0.995796',
            'price/fee/total unit': 'ETH',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        // Should generate 2 transactions: SELL LINK + BUY ETH
        expect(result).toHaveLength(2)

        // First: SELL of LINK (base currency being sold)
        expect(result[0]).toMatchObject({
          type: 'SELL',
          symbol: 'LINK',
          quantity: 60.0,
          price: 0.01668,
        })
        expect(result[0].notes).toContain('[Crypto-to-Crypto Disposal]')

        // Second: BUY of ETH (quote currency being acquired)
        expect(result[1]).toMatchObject({
          type: 'BUY',
          symbol: 'ETH',
          quantity: 0.995796, // Amount of ETH received
          fee: 0,
        })
        expect(result[1].notes).toContain('[Crypto-to-Crypto Acquisition]')
      })

      it('should use gbp_value as spot price of quote currency for crypto-to-crypto trades', () => {
        // gbp_value is the GBP price per unit of ETH (quote currency)
        // e.g., if ETH is worth £145 GBP at the time of trade
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '248602',
            'product': 'LINK-ETH',
            'side': 'BUY',
            'created at': '2020-03-08T02:07:38.824Z',
            'size': '28.23000000',
            'size unit': 'LINK',
            'price': '0.01834',
            'fee': '0.002588691',
            'total': '-0.520326891', // 0.520326891 ETH spent
            'price/fee/total unit': 'ETH',
            'gbp_value': '145', // £145 per ETH
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        expect(result).toHaveLength(2)

        // Expected GBP values:
        // Total in GBP = 0.520326891 ETH * £145/ETH = £75.4474
        // Fee in GBP = 0.002588691 ETH * £145/ETH = £0.3754

        // SELL ETH should have GBP values calculated from spot price
        expect(result[0]).toMatchObject({
          type: 'SELL',
          symbol: 'ETH',
          quantity: 0.520326891,
          price: 145, // GBP spot price per ETH
          currency: 'GBP',
        })
        expect(result[0].total).toBeCloseTo(0.520326891 * 145, 2) // ~75.45
        expect(result[0].fee).toBeCloseTo(0.002588691 * 145, 2) // ~0.375
        // Should NOT contain warning about missing gbp_value
        expect(result[0].notes).not.toContain('⚠️')

        // BUY LINK should have GBP values
        expect(result[1]).toMatchObject({
          type: 'BUY',
          symbol: 'LINK',
          quantity: 28.23,
          currency: 'GBP',
        })
        // Total in GBP should be same as SELL
        expect(result[1].total).toBeCloseTo(0.520326891 * 145, 2)
        // Price per LINK = total GBP / quantity LINK
        expect(result[1].price).toBeCloseTo((0.520326891 * 145) / 28.23, 4)
      })

      it('should add warning note when gbp_value is missing', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '248602',
            'product': 'LINK-ETH',
            'side': 'BUY',
            'created at': '2020-03-08T02:07:38.824Z',
            'size': '28.23000000',
            'size unit': 'LINK',
            'price': '0.01834',
            'fee': '0.002588691',
            'total': '-0.520326891',
            'price/fee/total unit': 'ETH',
            // No gbp_value column
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        expect(result).toHaveLength(2)

        // Both transactions should have warning
        expect(result[0].notes).toContain('⚠️')
        expect(result[0].notes).toContain('gbp_value')
        expect(result[1].notes).toContain('⚠️')
        expect(result[1].notes).toContain('gbp_value')

        // Currency should be ETH (crypto) instead of GBP
        expect(result[0].currency).toBe('ETH')
        expect(result[1].currency).toBe('ETH')
      })
    })

    describe('Date parsing', () => {
      it('should parse ISO 8601 timestamps correctly', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '123',
            'product': 'BTC-GBP',
            'side': 'BUY',
            'created at': '2020-10-14T10:42:20.072Z',
            'size': '0.1',
            'size unit': 'BTC',
            'price': '10000',
            'fee': '10',
            'total': '-1010',
            'price/fee/total unit': 'GBP',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        expect(result[0].date).toBe('2020-10-14')
      })

      it('should handle different date formats', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '123',
            'product': 'ETH-GBP',
            'side': 'SELL',
            'created at': '2023-12-31T23:59:59.999Z',
            'size': '1',
            'size unit': 'ETH',
            'price': '2000',
            'fee': '5',
            'total': '1995',
            'price/fee/total unit': 'GBP',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        expect(result[0].date).toBe('2023-12-31')
      })
    })

    describe('Fee handling', () => {
      it('should parse fees correctly for fiat trades', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '123',
            'product': 'XRP-GBP',
            'side': 'BUY',
            'created at': '2020-10-14T10:42:20.072Z',
            'size': '1000',
            'size unit': 'XRP',
            'price': '0.20',
            'fee': '1.50',
            'total': '-201.50',
            'price/fee/total unit': 'GBP',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        expect(result[0].fee).toBe(1.50)
      })

      it('should put fee on SELL transaction only for crypto-to-crypto trades', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '248602',
            'product': 'LINK-ETH',
            'side': 'BUY',
            'created at': '2020-03-08T02:07:38.824Z',
            'size': '28.23',
            'size unit': 'LINK',
            'price': '0.01834',
            'fee': '0.002588691',
            'total': '-0.520326891',
            'price/fee/total unit': 'ETH',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        // Fee should be on SELL (first transaction)
        expect(result[0].fee).toBe(0.002588691)
        // BUY should have no fee
        expect(result[1].fee).toBe(0)
      })
    })

    describe('Multiple transactions', () => {
      it('should handle multiple transactions with unique IDs', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '1',
            'product': 'BTC-GBP',
            'side': 'BUY',
            'created at': '2020-01-01T10:00:00.000Z',
            'size': '0.1',
            'size unit': 'BTC',
            'price': '7000',
            'fee': '5',
            'total': '-705',
            'price/fee/total unit': 'GBP',
          },
          {
            'portfolio': 'default',
            'trade id': '2',
            'product': 'ETH-GBP',
            'side': 'BUY',
            'created at': '2020-01-02T10:00:00.000Z',
            'size': '5',
            'size unit': 'ETH',
            'price': '150',
            'fee': '3',
            'total': '-753',
            'price/fee/total unit': 'GBP',
          },
          {
            'portfolio': 'default',
            'trade id': '3',
            'product': 'BTC-GBP',
            'side': 'SELL',
            'created at': '2020-01-03T10:00:00.000Z',
            'size': '0.05',
            'size unit': 'BTC',
            'price': '7500',
            'fee': '2',
            'total': '373',
            'price/fee/total unit': 'GBP',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        expect(result).toHaveLength(3)
        expect(result[0].id).toBe('test-file-1')
        expect(result[1].id).toBe('test-file-2')
        expect(result[2].id).toBe('test-file-3')

        expect(result[0].symbol).toBe('BTC')
        expect(result[1].symbol).toBe('ETH')
        expect(result[2].symbol).toBe('BTC')
      })

      it('should assign correct IDs when crypto-to-crypto generates multiple transactions', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '1',
            'product': 'BTC-GBP',
            'side': 'BUY',
            'created at': '2020-01-01T10:00:00.000Z',
            'size': '0.1',
            'size unit': 'BTC',
            'price': '7000',
            'fee': '5',
            'total': '-705',
            'price/fee/total unit': 'GBP',
          },
          {
            'portfolio': 'default',
            'trade id': '2',
            'product': 'LINK-ETH',
            'side': 'BUY',
            'created at': '2020-01-02T10:00:00.000Z',
            'size': '50',
            'size unit': 'LINK',
            'price': '0.02',
            'fee': '0.005',
            'total': '-1.005',
            'price/fee/total unit': 'ETH',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        // 1 fiat trade + 2 from crypto-to-crypto = 3 total
        expect(result).toHaveLength(3)
        expect(result[0].id).toBe('test-file-1') // BTC-GBP BUY
        expect(result[1].id).toBe('test-file-2') // LINK-ETH SELL ETH
        expect(result[2].id).toBe('test-file-3') // LINK-ETH BUY LINK
      })
    })

    describe('Edge cases', () => {
      it('should skip rows without essential data', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            // Missing product, side, created at
          },
          {
            'portfolio': 'default',
            'trade id': '1',
            'product': 'BTC-GBP',
            'side': 'BUY',
            'created at': '2020-01-01T10:00:00.000Z',
            'size': '0.1',
            'size unit': 'BTC',
            'price': '7000',
            'fee': '5',
            'total': '-705',
            'price/fee/total unit': 'GBP',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
        expect(result[0].symbol).toBe('BTC')
      })

      it('should skip header rows', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'portfolio',
            'trade id': 'trade id',
            'product': 'product',
            'side': 'side',
            'created at': 'created at',
            'size': 'size',
            'size unit': 'size unit',
            'price': 'price',
            'fee': 'fee',
            'total': 'total',
            'price/fee/total unit': 'price/fee/total unit',
          },
          {
            'portfolio': 'default',
            'trade id': '1',
            'product': 'BTC-GBP',
            'side': 'BUY',
            'created at': '2020-01-01T10:00:00.000Z',
            'size': '0.1',
            'size unit': 'BTC',
            'price': '7000',
            'fee': '5',
            'total': '-705',
            'price/fee/total unit': 'GBP',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
      })

      it('should handle different fiat currencies (USD, EUR)', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '1',
            'product': 'BTC-USD',
            'side': 'BUY',
            'created at': '2020-01-01T10:00:00.000Z',
            'size': '0.1',
            'size unit': 'BTC',
            'price': '10000',
            'fee': '5',
            'total': '-1005',
            'price/fee/total unit': 'USD',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        expect(result).toHaveLength(1)
        expect(result[0].currency).toBe('USD')
        expect(result[0].type).toBe('BUY')
      })

      it('should handle zero fee transactions', () => {
        const rows: RawCSVRow[] = [
          {
            'portfolio': 'default',
            'trade id': '1',
            'product': 'BTC-GBP',
            'side': 'BUY',
            'created at': '2020-01-01T10:00:00.000Z',
            'size': '0.1',
            'size unit': 'BTC',
            'price': '7000',
            'fee': '0',
            'total': '-700',
            'price/fee/total unit': 'GBP',
          },
        ]

        const result = normalizeCoinbaseProTransactions(rows, 'test-file')

        expect(result[0].fee).toBe(0)
      })
    })
  })
})
