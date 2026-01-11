import { describe, it, expect } from 'vitest'
import { applySameDayRule, getRemainingQuantity } from '../sameDayMatcher'
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

    it('should not double-match BUY shares when multiple SELLs on same day', () => {
      // Scenario: Multiple SELLs on same day competing for limited BUY shares
      // Two SELLs (100 and 50 shares = 150 total)
      // Two BUYs (30 and 90 shares = 120 total)
      // Expected: First SELL matches 100, second SELL only gets remaining 20
      const transactions: EnrichedTransaction[] = [
        {
          id: 'sell-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
          type: 'SELL',
          quantity: 100,
          price: 185,
          currency: 'USD',
          total: 18500,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 145.67,
          value_gbp: 14566.93,
          fee_gbp: 3.94,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
        {
          id: 'sell-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
          type: 'SELL',
          quantity: 50,
          price: 185,
          currency: 'USD',
          total: 9250,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 145.67,
          value_gbp: 7283.46,
          fee_gbp: 3.94,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
        {
          id: 'buy-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
          type: 'BUY',
          quantity: 30,
          price: 180,
          currency: 'USD',
          total: 5400,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 141.73,
          value_gbp: 4251.97,
          fee_gbp: 3.94,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
        {
          id: 'buy-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
          type: 'BUY',
          quantity: 90,
          price: 180,
          currency: 'USD',
          total: 16200,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 141.73,
          value_gbp: 12755.91,
          fee_gbp: 3.94,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
      ]

      const matchings = applySameDayRule(transactions)

      // Should have 2 matchings (one per SELL)
      expect(matchings).toHaveLength(2)

      // First SELL should match 100 shares (30 from buy-1 + 70 from buy-2)
      const firstSellMatching = matchings.find(m => m.disposal.id === 'sell-1')!
      expect(firstSellMatching.quantityMatched).toBe(100)

      // Second SELL should only match 20 shares (remaining from buy-2: 90 - 70 = 20)
      const secondSellMatching = matchings.find(m => m.disposal.id === 'sell-2')!
      expect(secondSellMatching.quantityMatched).toBe(20)

      // Total matched should equal total BUY shares (120), not exceed it
      const totalMatched = matchings.reduce((sum, m) => sum + m.quantityMatched, 0)
      expect(totalMatched).toBe(120)
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

    it('should apply contract_size multiplier for options cost basis calculation', () => {
      // Options scenario: Buy to Close and Sell to Open on the same day
      // Price is per-share ($9.50), quantity is 1 contract, contract_size is 100
      // Cost should be: $9.50 * 1 * 100 = $950 (plus fees)
      const transactions: EnrichedTransaction[] = [
        {
          id: 'sell-to-open',
          source: 'Charles Schwab',
          symbol: 'SMCI 03/22/2024 1200.00 C',
          name: 'CALL SUPER MICRO COMPUTE$1200 EXP 03/22/24',
          date: '2024-03-18',
          type: 'OPTIONS_SELL_TO_OPEN',
          quantity: 1,
          price: 41.50,
          currency: 'USD',
          total: 4149.31,
          fee: 0.69,
          notes: null,
          fx_rate: 1,
          price_gbp: 41.50,
          value_gbp: 4149.31,
          fee_gbp: 0.69,
          fx_source: 'test',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
          underlying_symbol: 'SMCI',
          option_type: 'CALL',
          strike_price: 1200.00,
          expiration_date: '2024-03-22',
          contract_size: 100,
        },
        {
          id: 'buy-to-close',
          source: 'Charles Schwab',
          symbol: 'SMCI 03/22/2024 1200.00 C',
          name: 'CALL SUPER MICRO COMPUTE$1200 EXP 03/22/24',
          date: '2024-03-18',
          type: 'OPTIONS_BUY_TO_CLOSE',
          quantity: 1,
          price: 9.50,
          currency: 'USD',
          total: 950.66,
          fee: 0.66,
          notes: null,
          fx_rate: 1,
          price_gbp: 9.50,
          value_gbp: 950.66,
          fee_gbp: 0.66,
          fx_source: 'test',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
          underlying_symbol: 'SMCI',
          option_type: 'CALL',
          strike_price: 1200.00,
          expiration_date: '2024-03-22',
          contract_size: 100,
        },
      ]

      const matchings = applySameDayRule(transactions)

      expect(matchings).toHaveLength(1)
      expect(matchings[0].rule).toBe('SAME_DAY')
      expect(matchings[0].disposal.id).toBe('sell-to-open')
      expect(matchings[0].acquisitions).toHaveLength(1)
      expect(matchings[0].acquisitions[0].transaction.id).toBe('buy-to-close')
      expect(matchings[0].quantityMatched).toBe(1)

      // Cost basis should include contract_size multiplier
      // (price_gbp + fee_gbp/quantity*contract_size) * quantity * contract_size
      // = (9.50 + 0.66/100) * 1 * 100 = 950.66
      expect(matchings[0].totalCostBasisGbp).toBeCloseTo(950.66, 1)
    })

    it('should handle multiple options contracts with contract_size', () => {
      // 3 contracts of options, each representing 100 shares
      const transactions: EnrichedTransaction[] = [
        {
          id: 'sell-to-open',
          source: 'Charles Schwab',
          symbol: 'CRWV 01/15/2027 110.00 C',
          name: 'CALL COREWEAVE INC $110 EXP 01/15/27',
          date: '2025-11-10',
          type: 'OPTIONS_SELL_TO_OPEN',
          quantity: 3,
          price: 41.00,
          currency: 'USD',
          total: 12298.02,
          fee: 1.98,
          notes: null,
          fx_rate: 1,
          price_gbp: 41.00,
          value_gbp: 12298.02,
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
        {
          id: 'buy-to-close',
          source: 'Charles Schwab',
          symbol: 'CRWV 01/15/2027 110.00 C',
          name: 'CALL COREWEAVE INC $110 EXP 01/15/27',
          date: '2025-11-10',
          type: 'OPTIONS_BUY_TO_CLOSE',
          quantity: 3,
          price: 35.00,
          currency: 'USD',
          total: 10501.50,
          fee: 1.50,
          notes: null,
          fx_rate: 1,
          price_gbp: 35.00,
          value_gbp: 10501.50,
          fee_gbp: 1.50,
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

      const matchings = applySameDayRule(transactions)

      expect(matchings).toHaveLength(1)
      expect(matchings[0].quantityMatched).toBe(3)

      // Cost basis = (35.00 + 1.50/300) * 3 * 100 = 10501.50
      expect(matchings[0].totalCostBasisGbp).toBeCloseTo(10501.50, 1)
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
