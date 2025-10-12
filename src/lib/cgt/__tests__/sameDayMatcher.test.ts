import { describe, it, expect } from 'vitest'
import { applySameDayRule, markSameDayMatches, getRemainingQuantity } from '../sameDayMatcher'
import { EnrichedTransaction } from '../../../types/transaction'

describe('Same-Day Matcher', () => {
  describe('applySameDayRule', () => {
    it('should match a buy and sell on the same day', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
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
          gain_group: 'NONE',
        },
      ]

      const matchings = applySameDayRule(transactions)

      expect(matchings).toHaveLength(1)
      expect(matchings[0].rule).toBe('SAME_DAY')
      expect(matchings[0].disposal.id).toBe('tx-2')
      expect(matchings[0].acquisitions).toHaveLength(1)
      expect(matchings[0].acquisitions[0].transaction.id).toBe('tx-1')
      expect(matchings[0].quantityMatched).toBe(10)
    })

    it('should handle partial matches when sell quantity exceeds buy quantity', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
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

      const matchings = applySameDayRule(transactions)

      expect(matchings).toHaveLength(1)
      expect(matchings[0].quantityMatched).toBe(5) // Only 5 matched, 5 remain unmatched
      expect(matchings[0].acquisitions[0].quantityMatched).toBe(5)
    })

    it('should match multiple buys against a single sell on same day', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
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
          gain_group: 'NONE',
        },
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
          type: 'BUY',
          quantity: 5,
          price: 182,
          currency: 'USD',
          total: 910,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 143.31,
          value_gbp: 716.54,
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

      const matchings = applySameDayRule(transactions)

      expect(matchings).toHaveLength(1)
      expect(matchings[0].acquisitions).toHaveLength(2)
      expect(matchings[0].quantityMatched).toBe(10)
    })

    it('should not match buys and sells on different days', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-14',
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
          gain_group: 'NONE',
        },
      ]

      const matchings = applySameDayRule(transactions)

      expect(matchings).toHaveLength(0)
    })

    it('should handle different symbols independently', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
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
          symbol: 'GOOGL',
          name: 'Alphabet Inc.',
          date: '2023-06-15',
          type: 'SELL',
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

      const matchings = applySameDayRule(transactions)

      expect(matchings).toHaveLength(0) // Different symbols, no match
    })
  })

  describe('markSameDayMatches', () => {
    it('should mark matched transactions with SAME_DAY gain group', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
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
          gain_group: 'NONE',
        },
      ]

      const matchings = applySameDayRule(transactions)
      const marked = markSameDayMatches(transactions, matchings)

      expect(marked[0].gain_group).toBe('SAME_DAY')
      expect(marked[1].gain_group).toBe('SAME_DAY')
    })
  })

  describe('getRemainingQuantity', () => {
    it('should return original quantity when no matchings exist', () => {
      const transaction: EnrichedTransaction = {
        id: 'tx-1',
        source: 'test',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2023-06-15',
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
      }

      const remaining = getRemainingQuantity(transaction, [])
      expect(remaining).toBe(10)
    })

    it('should return 0 when fully matched', () => {
      const transaction: EnrichedTransaction = {
        id: 'tx-1',
        source: 'test',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2023-06-15',
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
      }

      const matchings = [
        {
          disposal: transaction,
          acquisitions: [
            {
              transaction: { ...transaction, id: 'tx-0', type: 'BUY' as const },
              quantityMatched: 10,
              costBasisGbp: 1417.32,
            },
          ],
          rule: 'SAME_DAY' as const,
          quantityMatched: 10,
          totalCostBasisGbp: 1417.32,
        },
      ]

      const remaining = getRemainingQuantity(transaction, matchings)
      expect(remaining).toBe(0)
    })

    it('should return remaining quantity for partial matches', () => {
      const transaction: EnrichedTransaction = {
        id: 'tx-1',
        source: 'test',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2023-06-15',
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
      }

      const matchings = [
        {
          disposal: transaction,
          acquisitions: [
            {
              transaction: { ...transaction, id: 'tx-0', type: 'BUY' as const },
              quantityMatched: 6,
              costBasisGbp: 850.39,
            },
          ],
          rule: 'SAME_DAY' as const,
          quantityMatched: 6,
          totalCostBasisGbp: 850.39,
        },
      ]

      const remaining = getRemainingQuantity(transaction, matchings)
      expect(remaining).toBe(4)
    })
  })
})
