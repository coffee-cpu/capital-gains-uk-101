import { describe, it, expect } from 'vitest'
import { applyShortSellRule, markShortSellMatches, getRemainingQuantity } from '../shortSellMatcher'
import { EnrichedTransaction } from '../../../types/transaction'

/**
 * Helper to create a test transaction
 */
function createTransaction(
  overrides: Partial<EnrichedTransaction> & { id: string; date: string; type: 'BUY' | 'SELL'; quantity: number }
): EnrichedTransaction {
  return {
    source: 'test',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    currency: 'USD',
    total: overrides.quantity * (overrides.price || 100),
    fee: 5,
    notes: null,
    fx_rate: 1.27,
    price: overrides.price || 100,
    price_gbp: (overrides.price || 100) / 1.27,
    value_gbp: (overrides.quantity * (overrides.price || 100)) / 1.27,
    fee_gbp: 3.94,
    fx_source: 'HMRC',
    fx_error: null,
    tax_year: '2023/24',
    gain_group: 'NONE',
    ...overrides,
  }
}

describe('Short Sell Matcher', () => {
  describe('applyShortSellRule', () => {
    it('should match an explicit short sell (is_short_sell: true) with subsequent BUY', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({ id: 'sell-1', date: '2023-06-01', type: 'SELL', quantity: 100, price: 150, is_short_sell: true }),
        createTransaction({ id: 'buy-1', date: '2023-06-15', type: 'BUY', quantity: 100, price: 140 }),
      ]

      const matchings = applyShortSellRule(transactions)

      expect(matchings).toHaveLength(1)
      expect(matchings[0].rule).toBe('SHORT_SELL')
      expect(matchings[0].disposal.id).toBe('sell-1')
      expect(matchings[0].acquisitions).toHaveLength(1)
      expect(matchings[0].acquisitions[0].transaction.id).toBe('buy-1')
      expect(matchings[0].quantityMatched).toBe(100)
    })

    /**
     * EDUCATIONAL: This scenario is invalid for Schwab users.
     * Schwab requires explicit opt-in for short selling, so a SELL cannot occur
     * before a BUY unless it's marked as a short sell. This test documents the
     * expected behavior if such invalid data were to occur.
     */
    it.skip('should NOT match sells without is_short_sell flag (invalid scenario - educational only)', () => {
      const transactions: EnrichedTransaction[] = [
        // SELL before BUY, but no is_short_sell flag - should NOT be matched
        // NOTE: This scenario cannot happen with Schwab - they require explicit short sell opt-in
        createTransaction({ id: 'sell-1', date: '2023-06-01', type: 'SELL', quantity: 100, price: 150 }),
        createTransaction({ id: 'buy-1', date: '2023-06-15', type: 'BUY', quantity: 100, price: 140 }),
      ]

      const matchings = applyShortSellRule(transactions)

      // No short sell matches - is_short_sell flag is required
      expect(matchings).toHaveLength(0)
    })

    it('should not match normal trades (BUY before SELL without flag)', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({ id: 'buy-1', date: '2023-06-01', type: 'BUY', quantity: 100, price: 140 }),
        createTransaction({ id: 'sell-1', date: '2023-06-15', type: 'SELL', quantity: 100, price: 150 }),
      ]

      const matchings = applyShortSellRule(transactions)

      // No short sell matches - this is a normal trade
      expect(matchings).toHaveLength(0)
    })

    it('should match multiple explicit short sells with a single BUY (FIFO)', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({ id: 'sell-1', date: '2023-06-01', type: 'SELL', quantity: 50, price: 160, is_short_sell: true }),
        createTransaction({ id: 'sell-2', date: '2023-06-02', type: 'SELL', quantity: 30, price: 155, is_short_sell: true }),
        createTransaction({ id: 'buy-1', date: '2023-06-15', type: 'BUY', quantity: 80, price: 140 }),
      ]

      const matchings = applyShortSellRule(transactions)

      // Should have 2 matchings - one for each short sell
      expect(matchings).toHaveLength(2)

      // First short sell (sell-1) matched first (FIFO)
      expect(matchings[0].disposal.id).toBe('sell-1')
      expect(matchings[0].quantityMatched).toBe(50)
      expect(matchings[0].acquisitions[0].transaction.id).toBe('buy-1')

      // Second short sell (sell-2) matched next
      expect(matchings[1].disposal.id).toBe('sell-2')
      expect(matchings[1].quantityMatched).toBe(30)
      expect(matchings[1].acquisitions[0].transaction.id).toBe('buy-1')
    })

    it('should match single explicit short sell with multiple BUYs', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({ id: 'sell-1', date: '2023-06-01', type: 'SELL', quantity: 100, price: 160, is_short_sell: true }),
        createTransaction({ id: 'buy-1', date: '2023-06-15', type: 'BUY', quantity: 40, price: 140 }),
        createTransaction({ id: 'buy-2', date: '2023-06-20', type: 'BUY', quantity: 60, price: 145 }),
      ]

      const matchings = applyShortSellRule(transactions)

      // Should have 2 matchings for the same disposal (matched with 2 different BUYs)
      expect(matchings).toHaveLength(2)

      // Both matchings should be for sell-1
      expect(matchings[0].disposal.id).toBe('sell-1')
      expect(matchings[1].disposal.id).toBe('sell-1')

      // First matching with buy-1 for 40 shares
      expect(matchings[0].acquisitions[0].transaction.id).toBe('buy-1')
      expect(matchings[0].quantityMatched).toBe(40)

      // Second matching with buy-2 for 60 shares
      expect(matchings[1].acquisitions[0].transaction.id).toBe('buy-2')
      expect(matchings[1].quantityMatched).toBe(60)
    })

    it('should handle partial covering (some short positions remain uncovered)', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({ id: 'sell-1', date: '2023-06-01', type: 'SELL', quantity: 100, price: 160, is_short_sell: true }),
        createTransaction({ id: 'buy-1', date: '2023-06-15', type: 'BUY', quantity: 60, price: 140 }),
      ]

      const matchings = applyShortSellRule(transactions)

      // Only 60 shares matched, 40 remain uncovered
      expect(matchings).toHaveLength(1)
      expect(matchings[0].quantityMatched).toBe(60)
    })

    it('should only match short sell quantity when BUY quantity exceeds short sell (excess goes to Section 104)', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({ id: 'sell-1', date: '2023-06-01', type: 'SELL', quantity: 50, price: 160, is_short_sell: true }),
        createTransaction({ id: 'buy-1', date: '2023-06-15', type: 'BUY', quantity: 100, price: 140 }),
      ]

      const matchings = applyShortSellRule(transactions)

      // Only 50 shares matched (the short sell quantity)
      // The remaining 50 shares from BUY are NOT matched here - they go to Section 104 pool
      expect(matchings).toHaveLength(1)
      expect(matchings[0].disposal.id).toBe('sell-1')
      expect(matchings[0].quantityMatched).toBe(50)
      expect(matchings[0].acquisitions[0].transaction.id).toBe('buy-1')
      expect(matchings[0].acquisitions[0].quantityMatched).toBe(50)

      // Verify remaining quantity on the BUY transaction
      const buyRemaining = getRemainingQuantity(transactions[1], matchings)
      expect(buyRemaining).toBe(50) // 100 - 50 = 50 shares available for Section 104
    })

    it('should handle different symbols independently', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({ id: 'sell-aapl', date: '2023-06-01', type: 'SELL', quantity: 50, price: 160, symbol: 'AAPL', is_short_sell: true }),
        createTransaction({ id: 'sell-googl', date: '2023-06-02', type: 'SELL', quantity: 30, price: 100, symbol: 'GOOGL', is_short_sell: true }),
        createTransaction({ id: 'buy-aapl', date: '2023-06-15', type: 'BUY', quantity: 50, price: 140, symbol: 'AAPL' }),
        // No BUY for GOOGL - should remain uncovered
      ]

      const matchings = applyShortSellRule(transactions)

      // Only AAPL should have a match
      expect(matchings).toHaveLength(1)
      expect(matchings[0].disposal.symbol).toBe('AAPL')
      expect(matchings[0].quantityMatched).toBe(50)
    })

    it('should calculate correct cost basis from covering BUY', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({ id: 'sell-1', date: '2023-06-01', type: 'SELL', quantity: 100, price: 160, price_gbp: 126, is_short_sell: true }),
        createTransaction({
          id: 'buy-1',
          date: '2023-06-15',
          type: 'BUY',
          quantity: 100,
          price: 140,
          price_gbp: 110.24,
          fee_gbp: 5,
        }),
      ]

      const matchings = applyShortSellRule(transactions)

      expect(matchings).toHaveLength(1)
      // Cost basis = (price per share + fee per share) * quantity matched
      // = (110.24 + 5/100) * 100 = (110.24 + 0.05) * 100 = 110.29 * 100 = 11029
      expect(matchings[0].totalCostBasisGbp).toBeCloseTo(11029, 0)
    })

    it('should match explicit short sell alongside normal trades', () => {
      const transactions: EnrichedTransaction[] = [
        // Normal trade: BUY first, SELL later (no flag) - this is a regular long position
        createTransaction({ id: 'buy-1', date: '2023-05-01', type: 'BUY', quantity: 100, price: 140 }),
        createTransaction({ id: 'sell-1', date: '2023-05-15', type: 'SELL', quantity: 50, price: 150 }),
        // Explicit short sell with flag - user opted into short selling
        createTransaction({ id: 'sell-2', date: '2023-06-01', type: 'SELL', quantity: 80, price: 160, is_short_sell: true }),
        // Cover the short
        createTransaction({ id: 'buy-2', date: '2023-06-15', type: 'BUY', quantity: 80, price: 145 }),
      ]

      const matchings = applyShortSellRule(transactions)

      // Only the explicit short sell (sell-2) should be matched by this rule
      // The normal trade (buy-1/sell-1) will be matched by Section 104 pool rules
      expect(matchings).toHaveLength(1)
      expect(matchings[0].disposal.id).toBe('sell-2')
      expect(matchings[0].quantityMatched).toBe(80)
      expect(matchings[0].acquisitions[0].transaction.id).toBe('buy-2')
    })

    it('should process transactions in chronological order regardless of input order', () => {
      const transactions: EnrichedTransaction[] = [
        // Input in wrong order
        createTransaction({ id: 'buy-1', date: '2023-06-15', type: 'BUY', quantity: 100, price: 140 }),
        createTransaction({ id: 'sell-1', date: '2023-06-01', type: 'SELL', quantity: 100, price: 160, is_short_sell: true }),
      ]

      const matchings = applyShortSellRule(transactions)

      // Short sell should still be matched with the BUY
      expect(matchings).toHaveLength(1)
      expect(matchings[0].disposal.id).toBe('sell-1')
    })

    it('should match same-day short sell with same-day covering buy (options scenario)', () => {
      // Simulates options trading: Sell to Open and Buy to Close on the same day
      // e.g., SMCI 03/22/2024 1200.00 C - Sell to Open then Buy to Close on 03/18/2024
      const transactions: EnrichedTransaction[] = [
        // Note: Input order has BUY first - sort should still process short sell first
        createTransaction({
          id: 'buy-to-close',
          date: '2024-03-18',
          type: 'BUY',
          quantity: 1,
          price: 9.50,
          symbol: 'SMCI 03/22/2024 1200.00 C',
        }),
        createTransaction({
          id: 'sell-to-open',
          date: '2024-03-18',
          type: 'SELL',
          quantity: 1,
          price: 41.50,
          symbol: 'SMCI 03/22/2024 1200.00 C',
          is_short_sell: true,
        }),
      ]

      const matchings = applyShortSellRule(transactions)

      // Should match as SHORT_SELL, not fall through to SAME_DAY rule
      expect(matchings).toHaveLength(1)
      expect(matchings[0].rule).toBe('SHORT_SELL')
      expect(matchings[0].disposal.id).toBe('sell-to-open')
      expect(matchings[0].acquisitions[0].transaction.id).toBe('buy-to-close')
      expect(matchings[0].quantityMatched).toBe(1)
    })

    it('should handle empty transactions', () => {
      const matchings = applyShortSellRule([])
      expect(matchings).toHaveLength(0)
    })

    it('should handle transactions with only BUYs', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({ id: 'buy-1', date: '2023-06-01', type: 'BUY', quantity: 100, price: 140 }),
        createTransaction({ id: 'buy-2', date: '2023-06-15', type: 'BUY', quantity: 50, price: 145 }),
      ]

      const matchings = applyShortSellRule(transactions)
      expect(matchings).toHaveLength(0)
    })

    it('should use split-adjusted quantities when available', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({
          id: 'sell-1',
          date: '2023-06-01',
          type: 'SELL',
          quantity: 10,
          split_adjusted_quantity: 100, // After a 10:1 split
          price: 1600,
          is_short_sell: true,
        }),
        createTransaction({
          id: 'buy-1',
          date: '2023-06-15',
          type: 'BUY',
          quantity: 100,
          split_adjusted_quantity: 100,
          price: 140,
        }),
      ]

      const matchings = applyShortSellRule(transactions)

      expect(matchings).toHaveLength(1)
      expect(matchings[0].quantityMatched).toBe(100) // Uses split-adjusted quantity
    })

    it('should not match BUYs that occur before short sells', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({ id: 'buy-1', date: '2023-06-01', type: 'BUY', quantity: 100, price: 140 }),
        createTransaction({ id: 'sell-1', date: '2023-06-15', type: 'SELL', quantity: 100, price: 160, is_short_sell: true }),
        createTransaction({ id: 'buy-2', date: '2023-06-20', type: 'BUY', quantity: 100, price: 150 }),
      ]

      const matchings = applyShortSellRule(transactions)

      // Only buy-2 should match (comes after the short sell)
      expect(matchings).toHaveLength(1)
      expect(matchings[0].disposal.id).toBe('sell-1')
      expect(matchings[0].acquisitions[0].transaction.id).toBe('buy-2')
      expect(matchings[0].quantityMatched).toBe(100)
    })
  })

  describe('markShortSellMatches', () => {
    it('should mark matched transactions with SHORT_SELL gain group', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({ id: 'sell-1', date: '2023-06-01', type: 'SELL', quantity: 100, price: 160, is_short_sell: true }),
        createTransaction({ id: 'buy-1', date: '2023-06-15', type: 'BUY', quantity: 100, price: 140 }),
      ]

      const matchings = applyShortSellRule(transactions)
      const marked = markShortSellMatches(transactions, matchings)

      expect(marked[0].gain_group).toBe('SHORT_SELL')
      expect(marked[1].gain_group).toBe('SHORT_SELL')
    })

    it('should not mark normal long trades (matched by other rules)', () => {
      const transactions: EnrichedTransaction[] = [
        // Normal long trade: BUY first, then SELL from existing position
        createTransaction({ id: 'buy-1', date: '2023-06-01', type: 'BUY', quantity: 100, price: 140 }),
        createTransaction({ id: 'sell-1', date: '2023-06-15', type: 'SELL', quantity: 100, price: 150 }),
      ]

      const matchings = applyShortSellRule(transactions)
      const marked = markShortSellMatches(transactions, matchings)

      // Normal trade - should remain NONE (will be matched by Section 104 pool rules)
      expect(marked[0].gain_group).toBe('NONE')
      expect(marked[1].gain_group).toBe('NONE')
    })
  })

  describe('getRemainingQuantity', () => {
    it('should return original quantity when no matchings exist', () => {
      const transaction = createTransaction({ id: 'sell-1', date: '2023-06-01', type: 'SELL', quantity: 100, price: 160, is_short_sell: true })

      const remaining = getRemainingQuantity(transaction, [])
      expect(remaining).toBe(100)
    })

    it('should return 0 when fully matched as disposal', () => {
      const disposal = createTransaction({ id: 'sell-1', date: '2023-06-01', type: 'SELL', quantity: 100, price: 160, is_short_sell: true })
      const acquisition = createTransaction({ id: 'buy-1', date: '2023-06-15', type: 'BUY', quantity: 100, price: 140 })

      const matchings = [
        {
          disposal,
          acquisitions: [{ transaction: acquisition, quantityMatched: 100, costBasisGbp: 14000 }],
          rule: 'SHORT_SELL' as const,
          quantityMatched: 100,
          totalCostBasisGbp: 14000,
        },
      ]

      const remaining = getRemainingQuantity(disposal, matchings)
      expect(remaining).toBe(0)
    })

    it('should return remaining quantity for partial matches', () => {
      const disposal = createTransaction({ id: 'sell-1', date: '2023-06-01', type: 'SELL', quantity: 100, price: 160, is_short_sell: true })
      const acquisition = createTransaction({ id: 'buy-1', date: '2023-06-15', type: 'BUY', quantity: 60, price: 140 })

      const matchings = [
        {
          disposal,
          acquisitions: [{ transaction: acquisition, quantityMatched: 60, costBasisGbp: 8400 }],
          rule: 'SHORT_SELL' as const,
          quantityMatched: 60,
          totalCostBasisGbp: 8400,
        },
      ]

      const remaining = getRemainingQuantity(disposal, matchings)
      expect(remaining).toBe(40)
    })

    it('should return 0 when fully matched as acquisition', () => {
      const disposal = createTransaction({ id: 'sell-1', date: '2023-06-01', type: 'SELL', quantity: 100, price: 160, is_short_sell: true })
      const acquisition = createTransaction({ id: 'buy-1', date: '2023-06-15', type: 'BUY', quantity: 100, price: 140 })

      const matchings = [
        {
          disposal,
          acquisitions: [{ transaction: acquisition, quantityMatched: 100, costBasisGbp: 14000 }],
          rule: 'SHORT_SELL' as const,
          quantityMatched: 100,
          totalCostBasisGbp: 14000,
        },
      ]

      const remaining = getRemainingQuantity(acquisition, matchings)
      expect(remaining).toBe(0)
    })
  })
})
