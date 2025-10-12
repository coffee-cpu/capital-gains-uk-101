import { describe, it, expect } from 'vitest'
import { calculateCGT } from '../engine'
import { EnrichedTransaction } from '../../../types/transaction'

describe('CGT Engine', () => {
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

      expect(result.transactions[0].gain_group).toBe('SAME_DAY')
      expect(result.transactions[1].gain_group).toBe('SAME_DAY')
      expect(result.disposals).toHaveLength(1)
      expect(result.disposals[0].matchings[0].rule).toBe('SAME_DAY')
    })

    it('should apply 30-day rule after same-day', () => {
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

      const result = calculateCGT(transactions)

      expect(result.transactions[0].gain_group).toBe('30_DAY')
      expect(result.transactions[1].gain_group).toBe('30_DAY')
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

      // Buy should not be marked (goes into pool)
      // Sell should be marked as SECTION_104
      expect(result.transactions[1].gain_group).toBe('SECTION_104')
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

      // Verify all three rules were applied
      const sameDayMatches = result.transactions.filter(tx => tx.gain_group === 'SAME_DAY')
      const thirtyDayMatches = result.transactions.filter(tx => tx.gain_group === '30_DAY')

      expect(sameDayMatches.length).toBeGreaterThan(0) // tx-2 and part of tx-3
      expect(thirtyDayMatches.length).toBeGreaterThan(0) // tx-4 and part of tx-3

      // Should have one disposal record with multiple matchings
      expect(result.disposals.length).toBe(1)

      // Check that disposal has matchings from different rules
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
  })
})
