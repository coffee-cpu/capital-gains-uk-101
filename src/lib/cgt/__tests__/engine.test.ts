import { describe, it, expect } from 'vitest'
import { calculateCGT } from '../engine'
import { EnrichedTransaction } from '../../../types/transaction'

/**
 * Helper to create a test transaction with minimal required fields
 */
function createTransaction(overrides: Partial<EnrichedTransaction>): EnrichedTransaction {
  return {
    id: 'tx-1',
    source: 'test',
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    date: '2024-10-01',
    type: 'BUY',
    quantity: 10,
    price: 500,
    currency: 'USD',
    total: 5000,
    fee: 5,
    notes: null,
    fx_rate: 1.25,
    price_gbp: 400,
    value_gbp: 4000,
    fee_gbp: 4,
    fx_source: 'HMRC',
    fx_error: null,
    tax_year: '2024/25',
    gain_group: 'NONE',
    ...overrides,
  }
}

describe('CGT Engine', () => {
  describe('CGT Rate Change Split (30 Oct 2024)', () => {
    it('should split gains before and after rate change for tax year 2024/25', () => {
      const transactions: EnrichedTransaction[] = [
        // Acquisition before rate change
        createTransaction({
          id: 'buy-1',
          date: '2024-09-01',
          type: 'BUY',
          quantity: 20,
          price_gbp: 400,
          value_gbp: 8000,
          fee_gbp: 10,
        }),
        // Disposal BEFORE rate change (10%/20% rates)
        createTransaction({
          id: 'sell-1',
          date: '2024-10-15',
          type: 'SELL',
          quantity: 10,
          price_gbp: 450,
          value_gbp: 4500,
          fee_gbp: 5,
        }),
        // Disposal AFTER rate change (18%/24% rates)
        createTransaction({
          id: 'sell-2',
          date: '2024-11-15',
          type: 'SELL',
          quantity: 10,
          price_gbp: 480,
          value_gbp: 4800,
          fee_gbp: 5,
        }),
      ]

      const result = calculateCGT(transactions)
      const summary = result.taxYearSummaries.find(s => s.taxYear === '2024/25')

      expect(summary).toBeDefined()
      expect(summary!.hasRateChange).toBe(true)

      // Before rate change: gain from selling at 450 vs cost of ~405 (including fees)
      expect(summary!.gainsBeforeRateChange).toBeGreaterThan(0)
      expect(summary!.lossesBeforeRateChange).toBe(0)

      // After rate change: gain from selling at 480 vs cost of ~405 (including fees)
      expect(summary!.gainsAfterRateChange).toBeGreaterThan(0)
      expect(summary!.lossesAfterRateChange).toBe(0)
    })

    it('should handle disposal exactly on 30 Oct 2024 as "after" rate change', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({
          id: 'buy-1',
          date: '2024-09-01',
          type: 'BUY',
          quantity: 10,
          price_gbp: 400,
          value_gbp: 4000,
          fee_gbp: 10,
        }),
        // Disposal ON the rate change date (should be "after")
        createTransaction({
          id: 'sell-1',
          date: '2024-10-30',
          type: 'SELL',
          quantity: 10,
          price_gbp: 450,
          value_gbp: 4500,
          fee_gbp: 5,
        }),
      ]

      const result = calculateCGT(transactions)
      const summary = result.taxYearSummaries.find(s => s.taxYear === '2024/25')

      expect(summary).toBeDefined()
      expect(summary!.hasRateChange).toBe(true)
      expect(summary!.gainsBeforeRateChange).toBe(0)
      expect(summary!.gainsAfterRateChange).toBeGreaterThan(0)
    })

    it('should handle losses split between periods', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({
          id: 'buy-1',
          date: '2024-09-01',
          type: 'BUY',
          quantity: 20,
          price_gbp: 500,
          value_gbp: 10000,
          fee_gbp: 10,
        }),
        // Loss BEFORE rate change
        createTransaction({
          id: 'sell-1',
          date: '2024-10-15',
          type: 'SELL',
          quantity: 10,
          price_gbp: 400,
          value_gbp: 4000,
          fee_gbp: 5,
        }),
        // Loss AFTER rate change
        createTransaction({
          id: 'sell-2',
          date: '2024-11-15',
          type: 'SELL',
          quantity: 10,
          price_gbp: 350,
          value_gbp: 3500,
          fee_gbp: 5,
        }),
      ]

      const result = calculateCGT(transactions)
      const summary = result.taxYearSummaries.find(s => s.taxYear === '2024/25')

      expect(summary).toBeDefined()
      expect(summary!.hasRateChange).toBe(true)

      // Both should be losses
      expect(summary!.gainsBeforeRateChange).toBe(0)
      expect(summary!.lossesBeforeRateChange).toBeLessThan(0)
      expect(summary!.gainsAfterRateChange).toBe(0)
      expect(summary!.lossesAfterRateChange).toBeLessThan(0)

      // Net should equal sum
      expect(summary!.netGainOrLossBeforeRateChange).toBe(
        summary!.gainsBeforeRateChange! + summary!.lossesBeforeRateChange!
      )
      expect(summary!.netGainOrLossAfterRateChange).toBe(
        summary!.gainsAfterRateChange! + summary!.lossesAfterRateChange!
      )
    })

    it('should NOT have rate change fields for tax years other than 2024/25', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({
          id: 'buy-1',
          date: '2023-06-01',
          type: 'BUY',
          quantity: 10,
          price_gbp: 400,
          value_gbp: 4000,
          fee_gbp: 10,
          tax_year: '2023/24',
        }),
        createTransaction({
          id: 'sell-1',
          date: '2023-08-15',
          type: 'SELL',
          quantity: 10,
          price_gbp: 450,
          value_gbp: 4500,
          fee_gbp: 5,
          tax_year: '2023/24',
        }),
      ]

      const result = calculateCGT(transactions)
      const summary = result.taxYearSummaries.find(s => s.taxYear === '2023/24')

      expect(summary).toBeDefined()
      expect(summary!.hasRateChange).toBeUndefined()
      expect(summary!.gainsBeforeRateChange).toBeUndefined()
      expect(summary!.gainsAfterRateChange).toBeUndefined()
    })

    it('should handle all disposals before rate change', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({
          id: 'buy-1',
          date: '2024-05-01',
          type: 'BUY',
          quantity: 10,
          price_gbp: 400,
          value_gbp: 4000,
          fee_gbp: 10,
        }),
        createTransaction({
          id: 'sell-1',
          date: '2024-06-15',
          type: 'SELL',
          quantity: 10,
          price_gbp: 450,
          value_gbp: 4500,
          fee_gbp: 5,
        }),
      ]

      const result = calculateCGT(transactions)
      const summary = result.taxYearSummaries.find(s => s.taxYear === '2024/25')

      expect(summary).toBeDefined()
      expect(summary!.hasRateChange).toBe(true)
      expect(summary!.gainsBeforeRateChange).toBeGreaterThan(0)
      expect(summary!.gainsAfterRateChange).toBe(0)
      expect(summary!.lossesAfterRateChange).toBe(0)
    })

    it('should handle all disposals after rate change', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({
          id: 'buy-1',
          date: '2024-09-01',
          type: 'BUY',
          quantity: 10,
          price_gbp: 400,
          value_gbp: 4000,
          fee_gbp: 10,
        }),
        createTransaction({
          id: 'sell-1',
          date: '2024-12-15',
          type: 'SELL',
          quantity: 10,
          price_gbp: 450,
          value_gbp: 4500,
          fee_gbp: 5,
        }),
      ]

      const result = calculateCGT(transactions)
      const summary = result.taxYearSummaries.find(s => s.taxYear === '2024/25')

      expect(summary).toBeDefined()
      expect(summary!.hasRateChange).toBe(true)
      expect(summary!.gainsBeforeRateChange).toBe(0)
      expect(summary!.lossesBeforeRateChange).toBe(0)
      expect(summary!.gainsAfterRateChange).toBeGreaterThan(0)
    })

    it('should correctly calculate net gain/loss for each period', () => {
      const transactions: EnrichedTransaction[] = [
        createTransaction({
          id: 'buy-1',
          date: '2024-04-10',
          type: 'BUY',
          quantity: 30,
          price_gbp: 400,
          value_gbp: 12000,
          fee_gbp: 15,
        }),
        // Gain before rate change
        createTransaction({
          id: 'sell-1',
          date: '2024-08-01',
          type: 'SELL',
          quantity: 10,
          price_gbp: 450,
          value_gbp: 4500,
          fee_gbp: 5,
        }),
        // Loss before rate change
        createTransaction({
          id: 'sell-2',
          date: '2024-10-20',
          type: 'SELL',
          quantity: 10,
          price_gbp: 350,
          value_gbp: 3500,
          fee_gbp: 5,
        }),
        // Gain after rate change
        createTransaction({
          id: 'sell-3',
          date: '2024-11-01',
          type: 'SELL',
          quantity: 10,
          price_gbp: 500,
          value_gbp: 5000,
          fee_gbp: 5,
        }),
      ]

      const result = calculateCGT(transactions)
      const summary = result.taxYearSummaries.find(s => s.taxYear === '2024/25')

      expect(summary).toBeDefined()
      expect(summary!.hasRateChange).toBe(true)

      // Net before = gains + losses (losses are negative)
      expect(summary!.netGainOrLossBeforeRateChange).toBe(
        summary!.gainsBeforeRateChange! + summary!.lossesBeforeRateChange!
      )

      // Total net should match the overall tax year net
      const totalNetFromSplit =
        (summary!.netGainOrLossBeforeRateChange ?? 0) +
        (summary!.netGainOrLossAfterRateChange ?? 0)
      expect(totalNetFromSplit).toBeCloseTo(summary!.netGainOrLossGbp, 2)
    })
  })

  describe('calculateCGT', () => {
    it('should apply same-day rule first', () => {
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

      const result = calculateCGT(transactions)

      expect(result.disposals).toHaveLength(1)
      expect(result.disposals[0].matchings[0].rule).toBe('SAME_DAY')
    })

    it('should apply 30-day rule after same-day', () => {
      // To test 30-day rule, we need a scenario where:
      // 1. Shares are owned (via prior BUY)
      // 2. SELL happens (normal disposal, not short sell)
      // 3. BUY happens within 30 days after the SELL
      // The 30-day rule should match the SELL with the subsequent BUY
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-0',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-05-01',
          type: 'BUY',
          quantity: 10,
          price: 170,
          currency: 'USD',
          total: 1700,
          fee: 5,
          notes: null,
          fx_rate: 1.27,
          price_gbp: 133.86,
          value_gbp: 1338.58,
          fee_gbp: 3.94,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
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

      const result = calculateCGT(transactions)

      // tx-1 (SELL) should be matched with tx-2 (BUY) under 30-day rule
      expect(result.disposals).toHaveLength(1)
      expect(result.disposals[0].matchings[0].rule).toBe('30_DAY')
    })

    it('should apply Section 104 pooling for remaining shares', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-05-01',
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
          date: '2023-07-01',
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

      const result = calculateCGT(transactions)

      expect(result.disposals).toHaveLength(1)
      expect(result.disposals[0].matchings[0].rule).toBe('SECTION_104')
      expect(result.section104Pools.size).toBe(1)
    })

    it('should calculate gain/loss correctly', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
          type: 'BUY',
          quantity: 10,
          price: 100,
          currency: 'USD',
          total: 1000,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 100,
          value_gbp: 1000,
          fee_gbp: 10,
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
          price: 150,
          currency: 'USD',
          total: 1500,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 150,
          value_gbp: 1500,
          fee_gbp: 10,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
      ]

      const result = calculateCGT(transactions)

      const disposal = result.disposals[0]
      // Proceeds = 1500 - 10 = 1490
      // Costs = 1000 + 10 = 1010
      // Gain = 1490 - 1010 = 480
      expect(disposal.proceedsGbp).toBe(1490)
      expect(disposal.allowableCostsGbp).toBe(1010)
      expect(disposal.gainOrLossGbp).toBe(480)
    })

    it('should generate tax year summaries', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
          type: 'BUY',
          quantity: 10,
          price: 100,
          currency: 'USD',
          total: 1000,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 100,
          value_gbp: 1000,
          fee_gbp: 10,
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
          price: 150,
          currency: 'USD',
          total: 1500,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 150,
          value_gbp: 1500,
          fee_gbp: 10,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
      ]

      const result = calculateCGT(transactions)

      expect(result.taxYearSummaries).toHaveLength(1)

      const summary = result.taxYearSummaries[0]
      expect(summary.taxYear).toBe('2023/24')
      expect(summary.totalDisposals).toBe(1)
      expect(summary.totalGainsGbp).toBe(480)
      expect(summary.totalLossesGbp).toBe(0)
      expect(summary.netGainOrLossGbp).toBe(480)
      expect(summary.annualExemptAmount).toBe(6000) // 2023/24 allowance
      expect(summary.taxableGainGbp).toBe(0) // Below threshold
    })

    it('should handle complex scenario with all rules', () => {
      const transactions: EnrichedTransaction[] = [
        // Initial purchase (will go to Section 104 pool)
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-01-01',
          type: 'BUY',
          quantity: 50,
          price: 100,
          currency: 'USD',
          total: 5000,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 100,
          value_gbp: 5000,
          fee_gbp: 10,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2022/23',
          gain_group: 'NONE',
        },
        // Same-day buy and sell
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
          type: 'BUY',
          quantity: 10,
          price: 120,
          currency: 'USD',
          total: 1200,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 120,
          value_gbp: 1200,
          fee_gbp: 10,
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
          quantity: 30,
          price: 150,
          currency: 'USD',
          total: 4500,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 150,
          value_gbp: 4500,
          fee_gbp: 10,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
        // 30-day repurchase
        {
          id: 'tx-4',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-07-01',
          type: 'BUY',
          quantity: 5,
          price: 140,
          currency: 'USD',
          total: 700,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 140,
          value_gbp: 700,
          fee_gbp: 10,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
      ]

      const result = calculateCGT(transactions)

      // Should have one disposal record with multiple matchings
      expect(result.disposals.length).toBe(1)

      // Verify all three rules were applied by checking disposal matchings
      const disposal = result.disposals[0]
      const rules = disposal.matchings.map(m => m.rule)
      expect(rules).toContain('SAME_DAY')
      expect(rules).toContain('30_DAY')
      expect(rules).toContain('SECTION_104')

      // Should have section 104 pool with remaining shares
      expect(result.section104Pools.has('AAPL')).toBe(true)
      const pool = result.section104Pools.get('AAPL')!
      expect(pool.quantity).toBeGreaterThan(0) // Should have some shares left
    })

    it('should calculate metadata correctly', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
          type: 'BUY',
          quantity: 10,
          price: 100,
          currency: 'USD',
          total: 1000,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 100,
          value_gbp: 1000,
          fee_gbp: 10,
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
          price: 150,
          currency: 'USD',
          total: 1500,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 150,
          value_gbp: 1500,
          fee_gbp: 10,
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
          date: '2023-06-16',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 50,
          fee: 0,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 50,
          fee_gbp: 0,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
        },
      ]

      const result = calculateCGT(transactions)

      expect(result.metadata.totalTransactions).toBe(3)
      expect(result.metadata.totalBuys).toBe(1)
      expect(result.metadata.totalSells).toBe(1)
      expect(result.metadata.calculatedAt).toBeDefined()
    })

    it('should include dividend income in tax year summary', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 300,
          fee: 0,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 300,
          fee_gbp: 0,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
        },
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-07-20',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 250,
          fee: 0,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 250,
          fee_gbp: 0,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
        },
      ]

      const result = calculateCGT(transactions)

      expect(result.taxYearSummaries).toHaveLength(1)

      const summary = result.taxYearSummaries[0]
      expect(summary.taxYear).toBe('2024/25')
      expect(summary.totalDividends).toBe(2)
      expect(summary.totalDividendsGbp).toBe(550)
      expect(summary.dividendAllowance).toBe(500) // 2024/25 allowance
    })

    it('should calculate dividends below allowance correctly', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 200,
          fee: 0,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 200,
          fee_gbp: 0,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
        },
      ]

      const result = calculateCGT(transactions)

      const summary = result.taxYearSummaries[0]
      expect(summary.totalDividendsGbp).toBe(200)
      expect(summary.dividendAllowance).toBe(500)
    })

    it('should calculate correct dividend allowance for different tax years', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 600,
          fee: 0,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 600,
          fee_gbp: 0,
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
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 600,
          fee: 0,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 600,
          fee_gbp: 0,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
        },
        {
          id: 'tx-3',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2021-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 1000,
          fee: 0,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 1000,
          fee_gbp: 0,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2021/22',
          gain_group: 'NONE',
        },
      ]

      const result = calculateCGT(transactions)

      expect(result.taxYearSummaries).toHaveLength(3)

      // 2023/24 should have £1000 allowance
      const summary2023 = result.taxYearSummaries.find(s => s.taxYear === '2023/24')!
      expect(summary2023.dividendAllowance).toBe(1000)

      // 2024/25 should have £500 allowance
      const summary2024 = result.taxYearSummaries.find(s => s.taxYear === '2024/25')!
      expect(summary2024.dividendAllowance).toBe(500)

      // 2021/22 should have £2000 allowance
      const summary2021 = result.taxYearSummaries.find(s => s.taxYear === '2021/22')!
      expect(summary2021.dividendAllowance).toBe(2000)
    })

    it('should handle tax years with both CGT disposals and dividends', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-05-01',
          type: 'BUY',
          quantity: 10,
          price: 100,
          currency: 'USD',
          total: 1000,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 100,
          value_gbp: 1000,
          fee_gbp: 10,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
        },
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-05-01',
          type: 'SELL',
          quantity: 10,
          price: 150,
          currency: 'USD',
          total: 1500,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 150,
          value_gbp: 1500,
          fee_gbp: 10,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
        },
        {
          id: 'tx-3',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 300,
          fee: 0,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 300,
          fee_gbp: 0,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
        },
      ]

      const result = calculateCGT(transactions)

      expect(result.taxYearSummaries).toHaveLength(1)

      const summary = result.taxYearSummaries[0]
      // Check CGT calculations
      expect(summary.totalDisposals).toBe(1)
      expect(summary.netGainOrLossGbp).toBe(480) // (1500-10) - (1000+10)
      expect(summary.annualExemptAmount).toBe(3000)
      expect(summary.taxableGainGbp).toBe(0) // Below CGT threshold

      // Check dividend calculations
      expect(summary.totalDividends).toBe(1)
      expect(summary.totalDividendsGbp).toBe(300)
      expect(summary.dividendAllowance).toBe(500)
    })

    it('should include interest income in tax year summary', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'CASH',
          name: 'Savings Account',
          date: '2024-06-15',
          type: 'INTEREST',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 800,
          fee: 0,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 800,
          fee_gbp: 0,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
        },
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'CASH',
          name: 'Savings Account',
          date: '2024-07-20',
          type: 'INTEREST',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 400,
          fee: 0,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 400,
          fee_gbp: 0,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
        },
      ]

      const result = calculateCGT(transactions)

      expect(result.taxYearSummaries).toHaveLength(1)

      const summary = result.taxYearSummaries[0]
      expect(summary.taxYear).toBe('2024/25')
      expect(summary.totalInterest).toBe(2)
      expect(summary.totalInterestGbp).toBe(1200)
    })

    it('should handle disposals with no matching acquisitions (incomplete data)', () => {
      // Scenario: User sells shares but has no corresponding buy records
      // (e.g., shares bought before they started tracking transactions)
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'FOOD',
          name: 'FoodRetail',
          date: '2025-01-20',
          type: 'SELL',
          quantity: 40,
          price: 55,
          currency: 'GBP',
          total: 2200,
          fee: 0,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 55,
          value_gbp: 2200,
          fee_gbp: 0,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
        },
      ]

      const result = calculateCGT(transactions)

      // Should create a disposal record even with no acquisitions
      expect(result.disposals).toHaveLength(1)

      const disposal = result.disposals[0]
      // Disposal should be marked as incomplete
      expect(disposal.isIncomplete).toBe(true)
      expect(disposal.unmatchedQuantity).toBe(40)

      // Proceeds should be £0 (no matched shares, only unmatched)
      expect(disposal.proceedsGbp).toBe(0)

      // Cost basis and gain should both be 0 (no matched acquisitions)
      expect(disposal.allowableCostsGbp).toBe(0)
      expect(disposal.gainOrLossGbp).toBe(0) // No matched portion = no reportable gain

      // Should have one matching with quantityMatched = 0 (empty Section 104 pool)
      expect(disposal.matchings).toHaveLength(1)
      expect(disposal.matchings[0].rule).toBe('SECTION_104')
      expect(disposal.matchings[0].quantityMatched).toBe(0)

      // Tax year summary should reflect incomplete disposal
      const summary = result.taxYearSummaries[0]
      expect(summary.incompleteDisposals).toBe(1)
      expect(summary.totalDisposals).toBe(1)
    })

    it('should handle partial incomplete disposals', () => {
      // Scenario: User sells 100 shares but only has records for 60
      const transactions: EnrichedTransaction[] = [
        {
          id: 'tx-1',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-05-01',
          type: 'BUY',
          quantity: 60,
          price: 100,
          currency: 'USD',
          total: 6000,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 100,
          value_gbp: 6000,
          fee_gbp: 10,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
        },
        {
          id: 'tx-2',
          source: 'test',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-07-01',
          type: 'SELL',
          quantity: 100,
          price: 150,
          currency: 'USD',
          total: 15000,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 150,
          value_gbp: 15000,
          fee_gbp: 10,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
        },
      ]

      const result = calculateCGT(transactions)

      expect(result.disposals).toHaveLength(1)

      const disposal = result.disposals[0]
      // 60 shares matched, 40 shares unmatched
      expect(disposal.isIncomplete).toBe(true)
      expect(disposal.unmatchedQuantity).toBe(40)

      // Proceeds only for matched 60 shares (150 - 0.1 fee/share) * 60
      expect(disposal.proceedsGbp).toBeCloseTo(8994, 2) // (150 - 10/100) * 60

      // Cost basis only for matched 60 shares
      expect(disposal.allowableCostsGbp).toBeCloseTo(6010, 2) // 6000 + 10

      // Gain calculation: proceeds for matched 60 minus cost for 60
      expect(disposal.gainOrLossGbp).toBeCloseTo(2984, 2) // 8994 - 6010

      // Should have one Section 104 matching with 60 shares
      expect(disposal.matchings).toHaveLength(1)
      expect(disposal.matchings[0].quantityMatched).toBe(60)

      // Tax year summary should show incomplete disposal
      const summary = result.taxYearSummaries[0]
      expect(summary.incompleteDisposals).toBe(1)
    })
  })
})
