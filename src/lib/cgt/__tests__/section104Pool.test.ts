import { describe, it, expect } from 'vitest'
import { applySection104Pooling } from '../section104Pool'
import { EnrichedTransaction } from '../../../types/transaction'

describe('Section 104 Pool', () => {
  describe('applySection104Pooling', () => {
    it('should add shares to the pool on BUY', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-01',
          type: 'BUY',
          quantity: 10,
          price: 180,
          currency: 'USD',
          total: 1800,
          fee: 10,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 141.73,
          value_gbp: 1417.32,
          fee_gbp: 7.87,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
      ]

      const [matchings, pools] = applySection104Pooling(transactions, [])

      expect(matchings).toHaveLength(0) // No sells, no matchings
      expect(pools.size).toBe(1)

      const pool = pools.get('AAPL')!
      expect(pool.symbol).toBe('AAPL')
      expect(pool.quantity).toBe(10)
      expect(pool.totalCostGbp).toBeCloseTo(1417.32 + 7.87, 1)
      expect(pool.averageCostGbp).toBeCloseTo(142.519, 1)
      expect(pool.history).toHaveLength(1)
    })

    it('should match a sell against the pool', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-01',
          type: 'BUY',
          quantity: 10,
          price: 180,
          currency: 'USD',
          total: 1800,
          fee: 10,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 141.73,
          value_gbp: 1417.32,
          fee_gbp: 7.87,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-07-01',
          type: 'SELL',
          quantity: 5,
          price: 190,
          currency: 'USD',
          total: 950,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 149.61,
          value_gbp: 748.03,
          fee_gbp: 3.94,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
      ]

      const [matchings, pools] = applySection104Pooling(transactions, [])

      expect(matchings).toHaveLength(1)
      expect(matchings[0].rule).toBe('SECTION_104')
      expect(matchings[0].disposal.id).toBe('tx-2')
      expect(matchings[0].quantityMatched).toBe(5)

      const pool = pools.get('AAPL')!
      expect(pool.quantity).toBe(5) // 10 - 5 = 5 remaining
      expect(pool.history).toHaveLength(2) // One BUY, one SELL
    })

    it('should calculate average cost correctly across multiple buys', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-01',
          type: 'BUY',
          quantity: 10,
          price: 180,
          currency: 'USD',
          total: 1800,
          fee: 10,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 141.73,
          value_gbp: 1417.32,
          fee_gbp: 7.87,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
          type: 'BUY',
          quantity: 10,
          price: 200,
          currency: 'USD',
          total: 2000,
          fee: 10,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 157.48,
          value_gbp: 1574.80,
          fee_gbp: 7.87,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
      ]

      const [, pools] = applySection104Pooling(transactions, [])

      const pool = pools.get('AAPL')!
      expect(pool.quantity).toBe(20)
      // Average cost = (1417.32 + 7.87 + 1574.80 + 7.87) / 20
      const expectedAverage = (1417.32 + 7.87 + 1574.80 + 7.87) / 20
      expect(pool.averageCostGbp).toBeCloseTo(expectedAverage, 2)
    })

    it('should only use remaining unmatched quantities', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-01',
          type: 'BUY',
          quantity: 10,
          price: 180,
          currency: 'USD',
          total: 1800,
          fee: 10,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 141.73,
          value_gbp: 1417.32,
          fee_gbp: 7.87,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
          type: 'SELL',
          quantity: 10,
          price: 190,
          currency: 'USD',
          total: 1900,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 149.61,
          value_gbp: 1496.06,
          fee_gbp: 3.94,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
      ]

      // Simulate that 6 shares were already matched by previous rules
      const previousMatchings = [
        {
          disposal: transactions[1],
          acquisitions: [
            {
              transaction: transactions[0],
              quantityMatched: 6,
              costBasisGbp: 850.32,
            },
          ],
          rule: 'SAME_DAY' as const,
          quantityMatched: 6,
          totalCostBasisGbp: 850.32,
        },
      ]

      const [matchings, pools] = applySection104Pooling(transactions, previousMatchings)

      // Should add 4 to pool (10 - 6 matched)
      // Should match 4 from pool (10 - 6 matched)
      const pool = pools.get('AAPL')!
      expect(pool.quantity).toBe(0) // All shares used up
      expect(matchings).toHaveLength(1)
      expect(matchings[0].quantityMatched).toBe(4)
    })

    it('should handle different symbols independently', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-01',
          type: 'BUY',
          quantity: 10,
          price: 180,
          currency: 'USD',
          total: 1800,
          fee: 10,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 141.73,
          value_gbp: 1417.32,
          fee_gbp: 7.87,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'GOOGL',
          name: 'Alphabet Inc.',
          date: '2023-06-01',
          type: 'BUY',
          quantity: 5,
          price: 120,
          currency: 'USD',
          total: 600,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 94.49,
          value_gbp: 472.44,
          fee_gbp: 3.94,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
      ]

      const [, pools] = applySection104Pooling(transactions, [])

      expect(pools.size).toBe(2)
      expect(pools.get('AAPL')?.quantity).toBe(10)
      expect(pools.get('GOOGL')?.quantity).toBe(5)
    })

    it('should handle partial sells from pool', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-01',
          type: 'BUY',
          quantity: 100,
          price: 180,
          currency: 'USD',
          total: 18000,
          fee: 10,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 141.73,
          value_gbp: 14173.23,
          fee_gbp: 7.87,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-07-01',
          type: 'SELL',
          quantity: 25,
          price: 190,
          currency: 'USD',
          total: 4750,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 149.61,
          value_gbp: 3740.16,
          fee_gbp: 3.94,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
        {
          id: 'tx-3',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-08-01',
          type: 'SELL',
          quantity: 25,
          price: 195,
          currency: 'USD',
          total: 4875,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 153.54,
          value_gbp: 3838.58,
          fee_gbp: 3.94,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
      ]

      const [matchings, pools] = applySection104Pooling(transactions, [])

      expect(matchings).toHaveLength(2)
      const pool = pools.get('AAPL')!
      expect(pool.quantity).toBe(50) // 100 - 25 - 25
    })

    it('should apply contract_size multiplier for options cost basis when adding to pool', () => {
      // Options scenario: Buy to Open adds to pool
      // Price is per-share ($41.00), quantity is 3 contracts, contract_size is 100
      // Cost should be: $41.00 * 3 * 100 = $12,300 (plus fees)
      const transactions: EnrichedTransaction[] = [
        {
          id: 'buy-to-open',
          source: 'Charles Schwab',
          symbol: 'CRWV 01/15/2027 110.00 C',
          name: 'CALL COREWEAVE INC $110 EXP 01/15/27',
          date: '2025-11-10',
          type: 'OPTIONS_BUY_TO_OPEN',
          quantity: 3,
          price: 41.00,
          currency: 'USD',
          total: 12301.98,
          fee: 1.98,
          notes: null,
          fx_rate: 1,
          price_gbp: 41.00,
          value_gbp: 12301.98,
          fee_gbp: 1.98,
          fx_source: 'test',
          fx_error: null,
          tax_year: '2025/26',
          gain_group: 'NONE',
          underlying_symbol: 'CRWV',
          option_type: 'CALL',
          strike_price: 110.00,
          expiration_date: '2027-01-15',
          contract_size: 100,
        },
      ]

      const [matchings, pools] = applySection104Pooling(transactions, [])

      expect(matchings).toHaveLength(0) // No sells, no matchings
      expect(pools.size).toBe(1)

      const pool = pools.get('CRWV 01/15/2027 110.00 C')!
      expect(pool.symbol).toBe('CRWV 01/15/2027 110.00 C')
      expect(pool.quantity).toBe(3)

      // Total cost should include contract_size multiplier
      // (price_gbp + fee_gbp/(quantity*contract_size)) * quantity * contract_size
      // = (41.00 + 1.98/300) * 3 * 100 = 12301.98
      expect(pool.totalCostGbp).toBeCloseTo(12301.98, 1)
      expect(pool.averageCostGbp).toBeCloseTo(12301.98 / 3, 1)
    })

    it('should handle options with multiple buys and sell from pool', () => {
      // Buy 2 contracts, then buy 3 more, then sell 4 from pool
      const transactions: EnrichedTransaction[] = [
        {
          id: 'buy-1',
          source: 'Charles Schwab',
          symbol: 'GOOGL 01/16/2026 160.00 C',
          name: 'CALL ALPHABET INC $160 EXP 01/16/26',
          date: '2025-06-01',
          type: 'OPTIONS_BUY_TO_OPEN',
          quantity: 2,
          price: 20.00,
          currency: 'USD',
          total: 4001.00,
          fee: 1.00,
          notes: null,
          fx_rate: 1,
          price_gbp: 20.00,
          value_gbp: 4001.00,
          fee_gbp: 1.00,
          fx_source: 'test',
          fx_error: null,
          tax_year: '2025/26',
          gain_group: 'NONE',
          underlying_symbol: 'GOOGL',
          option_type: 'CALL',
          strike_price: 160.00,
          expiration_date: '2026-01-16',
          contract_size: 100,
        },
        {
          id: 'buy-2',
          source: 'Charles Schwab',
          symbol: 'GOOGL 01/16/2026 160.00 C',
          name: 'CALL ALPHABET INC $160 EXP 01/16/26',
          date: '2025-07-01',
          type: 'OPTIONS_BUY_TO_OPEN',
          quantity: 3,
          price: 25.00,
          currency: 'USD',
          total: 7501.50,
          fee: 1.50,
          notes: null,
          fx_rate: 1,
          price_gbp: 25.00,
          value_gbp: 7501.50,
          fee_gbp: 1.50,
          fx_source: 'test',
          fx_error: null,
          tax_year: '2025/26',
          gain_group: 'NONE',
          underlying_symbol: 'GOOGL',
          option_type: 'CALL',
          strike_price: 160.00,
          expiration_date: '2026-01-16',
          contract_size: 100,
        },
        {
          id: 'sell-1',
          source: 'Charles Schwab',
          symbol: 'GOOGL 01/16/2026 160.00 C',
          name: 'CALL ALPHABET INC $160 EXP 01/16/26',
          date: '2025-08-01',
          type: 'OPTIONS_SELL_TO_CLOSE',
          quantity: 4,
          price: 30.00,
          currency: 'USD',
          total: 11998.00,
          fee: 2.00,
          notes: null,
          fx_rate: 1,
          price_gbp: 30.00,
          value_gbp: 11998.00,
          fee_gbp: 2.00,
          fx_source: 'test',
          fx_error: null,
          tax_year: '2025/26',
          gain_group: 'NONE',
          underlying_symbol: 'GOOGL',
          option_type: 'CALL',
          strike_price: 160.00,
          expiration_date: '2026-01-16',
          contract_size: 100,
        },
      ]

      const [matchings, pools] = applySection104Pooling(transactions, [])

      expect(matchings).toHaveLength(1)
      expect(matchings[0].rule).toBe('SECTION_104')
      expect(matchings[0].disposal.id).toBe('sell-1')
      expect(matchings[0].quantityMatched).toBe(4)

      const pool = pools.get('GOOGL 01/16/2026 160.00 C')!
      expect(pool.quantity).toBe(1) // 2 + 3 - 4 = 1 remaining

      // Pool should have average cost per contract
      // Total cost after buys: (20 + 1/200)*2*100 + (25 + 1.5/300)*3*100 = 4001 + 7501.5 = 11502.5
      // After selling 4: remaining cost = 11502.5 * (1/5) = 2300.5
      expect(pool.history).toHaveLength(3) // 2 buys + 1 sell
    })
  })
})
