import { describe, it, expect } from 'vitest'
import { applyThirtyDayRule, markThirtyDayMatches } from '../thirtyDayMatcher'
import { EnrichedTransaction } from '../../../types/transaction'

describe('30-Day Matcher', () => {
  describe('applyThirtyDayRule', () => {
    it('should match a sell with a buy within 30 days', () => {
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
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-10',
          type: 'BUY',
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
          gain_group: 'NONE',
        },
      ]

      const matchings = applyThirtyDayRule(transactions, [])

      expect(matchings).toHaveLength(1)
      expect(matchings[0].rule).toBe('30_DAY')
      expect(matchings[0].disposal.id).toBe('tx-1')
      expect(matchings[0].acquisitions[0].transaction.id).toBe('tx-2')
      expect(matchings[0].quantityMatched).toBe(10)
    })

    it('should not match a buy that occurred chronologically before the sell', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-05-20',
          type: 'BUY',
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
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-01',
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
          gain_group: 'NONE',
        },
      ]

      const matchings = applyThirtyDayRule(transactions, [])

      expect(matchings).toHaveLength(0) // Buy was before sell, not after
    })

    it('should not match a buy on the same day as the sell', () => {
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
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-01',
          type: 'BUY',
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
          gain_group: 'NONE',
        },
      ]

      const matchings = applyThirtyDayRule(transactions, [])

      expect(matchings).toHaveLength(0) // Same day should be handled by same-day rule
    })

    it('should not match a buy more than 30 days after the sell', () => {
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
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-07-05', // 34 days later
          type: 'BUY',
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
          gain_group: 'NONE',
        },
      ]

      const matchings = applyThirtyDayRule(transactions, [])

      expect(matchings).toHaveLength(0) // Beyond 30-day window
    })

    it('should match exactly on day 30', () => {
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
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-07-01', // Exactly 30 days later
          type: 'BUY',
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
          gain_group: 'NONE',
        },
      ]

      const matchings = applyThirtyDayRule(transactions, [])

      expect(matchings).toHaveLength(1) // Day 30 is inclusive
    })

    it('should skip quantities already matched by same-day rule', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-01',
          type: 'BUY',
          quantity: 5,
          price: 180,
          currency: 'USD',
          total: 900,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 141.73,
          value_gbp: 708.66,
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
          date: '2023-06-01',
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
          gain_group: 'NONE',
        },
        {
          id: 'tx-3',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
          type: 'BUY',
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

      const sameDayMatchings = [
        {
          disposal: transactions[1],
          acquisitions: [
            {
              transaction: transactions[0],
              quantityMatched: 5,
              costBasisGbp: 708.66,
            },
          ],
          rule: 'SAME_DAY' as const,
          quantityMatched: 5,
          totalCostBasisGbp: 708.66,
        },
      ]

      const matchings = applyThirtyDayRule(transactions, sameDayMatchings)

      expect(matchings).toHaveLength(1)
      expect(matchings[0].quantityMatched).toBe(5) // Only 5 remaining after same-day match
    })

    it('should match multiple buys in FIFO order within 30-day window', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-01',
          type: 'SELL',
          quantity: 15,
          price: 180,
          currency: 'USD',
          total: 2700,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 141.73,
          value_gbp: 2125.98,
          fee_gbp: 3.94,
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
          date: '2023-06-10',
          type: 'BUY',
          quantity: 5,
          price: 185,
          currency: 'USD',
          total: 925,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 145.67,
          value_gbp: 728.35,
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
          date: '2023-06-20',
          type: 'BUY',
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

      const matchings = applyThirtyDayRule(transactions, [])

      expect(matchings).toHaveLength(1)
      expect(matchings[0].acquisitions).toHaveLength(2)
      expect(matchings[0].acquisitions[0].transaction.id).toBe('tx-2') // First buy chronologically
      expect(matchings[0].acquisitions[1].transaction.id).toBe('tx-3')
      expect(matchings[0].quantityMatched).toBe(15)
    })
  })

  describe('markThirtyDayMatches', () => {
    it('should mark matched transactions with 30_DAY gain group', () => {
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
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-10',
          type: 'BUY',
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
          gain_group: 'NONE',
        },
      ]

      const matchings = applyThirtyDayRule(transactions, [])
      const marked = markThirtyDayMatches(transactions, matchings)

      expect(marked[0].gain_group).toBe('30_DAY')
      expect(marked[1].gain_group).toBe('30_DAY')
    })

    it('should not overwrite SAME_DAY gain group', () => {
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
      ]

      const matchings = [
        {
          disposal: transactions[0],
          acquisitions: [],
          rule: '30_DAY' as const,
          quantityMatched: 10,
          totalCostBasisGbp: 1417.32,
        },
      ]

      const marked = markThirtyDayMatches(transactions, matchings)

      expect(marked[0].gain_group).toBe('SAME_DAY') // Should remain SAME_DAY
    })
  })
})
