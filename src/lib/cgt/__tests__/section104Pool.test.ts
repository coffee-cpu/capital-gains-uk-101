import { describe, it, expect } from 'vitest'
import { applySection104Pooling, markSection104Matches } from '../section104Pool'
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
  })

  describe('markSection104Matches', () => {
    it('should mark matched transactions with SECTION_104 gain group', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-01',
          type: 'SELL',
          quantity: 10,
          price: 180,
          currency: 'USD',
          total: 1800,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 141.73,
          value_gbp: 1417.32,
          fee_gbp: 3.94,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
      ]

      const matchings = [
        {
          disposal: transactions[0],
          acquisitions: [],
          rule: 'SECTION_104' as const,
          quantityMatched: 10,
          totalCostBasisGbp: 1417.32,
        },
      ]

      const marked = markSection104Matches(transactions, matchings)

      expect(marked[0].gain_group).toBe('SECTION_104')
    })

    it('should not overwrite SAME_DAY or 30_DAY gain groups', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-01',
          type: 'SELL',
          quantity: 10,
          price: 180,
          currency: 'USD',
          total: 1800,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 141.73,
          value_gbp: 1417.32,
          fee_gbp: 3.94,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'SAME_DAY',
        },
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
          type: 'SELL',
          quantity: 10,
          price: 185,
          currency: 'USD',
          total: 1850,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 145.67,
          value_gbp: 1456.69,
          fee_gbp: 3.94,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: '30_DAY',
        },
      ]

      const matchings = [
        {
          disposal: transactions[0],
          acquisitions: [],
          rule: 'SECTION_104' as const,
          quantityMatched: 10,
          totalCostBasisGbp: 1417.32,
        },
        {
          disposal: transactions[1],
          acquisitions: [],
          rule: 'SECTION_104' as const,
          quantityMatched: 10,
          totalCostBasisGbp: 1456.69,
        },
      ]

      const marked = markSection104Matches(transactions, matchings)

      expect(marked[0].gain_group).toBe('SAME_DAY') // Should remain
      expect(marked[1].gain_group).toBe('30_DAY') // Should remain
    })
  })
})
