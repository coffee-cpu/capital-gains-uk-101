import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { calculateCGT } from '../engine'
import { EnrichedTransaction } from '../../../types/transaction'
import { getTaxYear } from '../../../utils/taxYear'
import { normalizeInteractiveBrokersTransactions } from '../../parsers/interactiveBrokers'

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

describe('CGT Engine - HMRC matching regressions', () => {
  // GBP trades with no fees, so cost and proceeds are simply quantity × price
  function trade(
    id: string,
    date: string,
    type: 'BUY' | 'SELL',
    quantity: number,
    price: number
  ): EnrichedTransaction {
    return {
      id,
      source: 'test',
      symbol: 'VOD',
      name: 'Vodafone',
      date,
      type,
      quantity,
      price,
      currency: 'GBP',
      total: quantity * price,
      fee: 0,
      notes: null,
      fx_rate: 1,
      price_gbp: price,
      value_gbp: quantity * price,
      fee_gbp: 0,
      fx_source: 'Native GBP',
      fx_error: null,
      tax_year: getTaxYear(date),
    }
  }

  describe('same-day rule treats the day as one acquisition (TCGA92/S105(1))', () => {
    it('matches a partial same-day sell at the average cost of the day\'s buys', () => {
      const result = calculateCGT([
        trade('buy-1', '2024-05-01', 'BUY', 10, 100),
        trade('buy-2', '2024-05-01', 'BUY', 10, 200),
        trade('sell-1', '2024-05-01', 'SELL', 10, 150),
      ])

      // Day's average cost is £150, so selling at £150 is no gain (FIFO gave £500)
      expect(result.disposals[0].allowableCostsGbp).toBeCloseTo(1500, 6)
      expect(result.disposals[0].gainOrLossGbp).toBeCloseTo(0, 6)

      // The 10 unmatched shares enter the pool at the same £150 average
      const pool = result.section104Pools.get('VOD')!
      expect(pool.quantity).toBeCloseTo(10, 9)
      expect(pool.totalCostGbp).toBeCloseTo(1500, 6)
    })

    it('gives every same-day sell the same average cost', () => {
      const result = calculateCGT([
        trade('buy-1', '2024-05-01', 'BUY', 30, 100),
        trade('buy-2', '2024-05-01', 'BUY', 90, 200),
        trade('sell-1', '2024-05-01', 'SELL', 100, 250),
        trade('sell-2', '2024-05-01', 'SELL', 50, 250),
      ])

      // 120 shares bought at an average of £175; each sell is 80% matched
      for (const disposal of result.disposals) {
        const sameDay = disposal.matchings.find(m => m.rule === 'SAME_DAY')!
        expect(sameDay.totalCostBasisGbp / sameDay.quantityMatched).toBeCloseTo(175, 6)
      }
    })
    it('keeps fractional same-day matches exact with no near-zero rows', () => {
      const result = calculateCGT([
        trade('buy-1', '2024-05-01', 'BUY', 0.1, 100),
        trade('buy-2', '2024-05-01', 'BUY', 0.2, 200),
        trade('buy-3', '2024-05-01', 'BUY', 0.3, 300),
        trade('sell-1', '2024-05-01', 'SELL', 0.15, 250),
        trade('sell-2', '2024-05-01', 'SELL', 0.2, 250),
      ])

      const sameDay = result.disposals.map(d => d.matchings.find(m => m.rule === 'SAME_DAY')!)
      expect(sameDay.map(m => m.quantityMatched)).toEqual([0.15, 0.2])
      for (const matching of sameDay) {
        matching.acquisitions.forEach(acq => expect(acq.quantityMatched).toBeGreaterThan(1e-9))
        // Day's average cost: (10 + 40 + 90) / 0.6 = £233.33
        expect(matching.totalCostBasisGbp / matching.quantityMatched).toBeCloseTo(140 / 0.6, 6)
      }

      // The unmatched 0.25 shares carry the same average into the pool
      const pool = result.section104Pools.get('VOD')!
      expect(pool.quantity).toBeCloseTo(0.25, 9)
      expect(pool.totalCostGbp / pool.quantity).toBeCloseTo(140 / 0.6, 6)
    })
  })

  describe('30-day rule window', () => {
    let originalTZ: string | undefined
    beforeAll(() => {
      // The bug only appeared outside UTC; force UK time so CI catches it
      originalTZ = process.env.TZ
      process.env.TZ = 'Europe/London'
    })
    afterAll(() => {
      process.env.TZ = originalTZ
    })

    it('matches a rebuy on day 30 when the window crosses the BST change', () => {
      // 20 Mar + 30 days = 19 Apr; clocks go forward on 31 Mar 2024
      const result = calculateCGT([
        trade('buy-0', '2023-01-03', 'BUY', 10, 100),
        trade('sell-1', '2024-03-20', 'SELL', 10, 50),
        trade('buy-1', '2024-04-19', 'BUY', 10, 60),
      ])

      const matching = result.disposals[0].matchings
      expect(matching.map(m => m.rule)).toEqual(['30_DAY'])
      expect(matching[0].acquisitions[0].transaction.id).toBe('buy-1')
    })

    it('still excludes a rebuy on day 31 across the BST change', () => {
      const result = calculateCGT([
        trade('buy-0', '2023-01-03', 'BUY', 10, 100),
        trade('sell-1', '2024-03-20', 'SELL', 10, 50),
        trade('buy-1', '2024-04-20', 'BUY', 10, 60),
      ])

      expect(result.disposals[0].matchings.map(m => m.rule)).toEqual(['SECTION_104'])
    })

    it('matches same-day rebuys within the window at their average cost', () => {
      const result = calculateCGT([
        trade('sell-1', '2024-06-03', 'SELL', 10, 150),
        trade('buy-1', '2024-06-10', 'BUY', 10, 100),
        trade('buy-2', '2024-06-10', 'BUY', 10, 200),
      ])

      const matching = result.disposals[0].matchings[0]
      expect(matching.rule).toBe('30_DAY')
      expect(matching.totalCostBasisGbp).toBeCloseTo(1500, 6)
    })
  })

  describe('fractional quantities', () => {
    it('does not leave floating-point residue as unmatched or pooled shares', () => {
      const result = calculateCGT([
        trade('buy-1', '2024-05-01', 'BUY', 0.1, 100),
        trade('buy-2', '2024-05-02', 'BUY', 0.2, 100),
        trade('sell-1', '2024-06-03', 'SELL', 0.3, 120),
      ])

      expect(result.disposals[0].isIncomplete).toBe(false)
      expect(result.section104Pools.get('VOD')!.quantity).toBe(0)
      expect(result.section104Pools.get('VOD')!.totalCostGbp).toBe(0)
    })
  })
})

describe('CGT Engine - dividend and interest withholding tax', () => {
  // GBP rows, so value_gbp equals the broker's stored total
  function row(id: string, type: EnrichedTransaction['type'], total: number): EnrichedTransaction {
    return {
      id,
      source: 'test',
      symbol: type === 'TAX_ON_INTEREST' || type === 'INTEREST' ? '' : 'AAPL',
      name: null,
      date: '2024-09-29',
      type,
      quantity: null,
      price: null,
      currency: 'GBP',
      total,
      fee: null,
      notes: null,
      fx_rate: 1,
      price_gbp: null,
      value_gbp: total,
      fee_gbp: null,
      fx_source: 'Native GBP',
      fx_error: null,
      tax_year: getTaxYear('2024-09-29'),
    }
  }

  it('counts a negative tax row from a non-IB source as tax withheld', () => {
    const summary = calculateCGT([
      row('div', 'DIVIDEND', 25),
      row('tax', 'TAX_ON_DIVIDEND', -3.75),
    ]).taxYearSummaries[0]

    expect(summary.totalWithholdingTaxGbp).toBeCloseTo(3.75, 6)
    expect(summary.totalDividendsGbp).toBeCloseTo(21.25, 6)
  })

  it('counts a positive tax row (Schwab) as tax withheld', () => {
    const summary = calculateCGT([
      row('div', 'DIVIDEND', 25),
      row('tax', 'TAX_ON_DIVIDEND', 3.75),
    ]).taxYearSummaries[0]

    expect(summary.totalWithholdingTaxGbp).toBeCloseTo(3.75, 6)
    expect(summary.totalDividendsGbp).toBeCloseTo(21.25, 6)
  })

  it('counts non-IB interest withholding the same way, whatever the sign', () => {
    const summary = calculateCGT([
      row('int', 'INTEREST', 10),
      row('tax-ib', 'TAX_ON_INTEREST', -2),
      row('tax-schwab', 'TAX_ON_INTEREST', 1),
    ]).taxYearSummaries[0]

    expect(summary.interestWithholdingTaxGbp).toBeCloseTo(3, 6)
    expect(summary.totalInterestGbp).toBeCloseTo(7, 6)
  })

  const ibRow = (type: string, description: string, amount: string) => ({
    'Section': 'Transaction History',
    'RowType': 'Data',
    'Date': '2024-09-29',
    'Account': 'U1234567',
    'Description': description,
    'Transaction Type': type,
    'Symbol': 'AAPL',
    'Quantity': '-',
    'Price': '-',
    'Gross Amount ': amount,
    'Commission': '-',
    'Net Amount': amount,
  })

  // Parses IB rows and enriches them as native GBP
  function parseIB(rows: Record<string, string>[]): EnrichedTransaction[] {
    return normalizeInteractiveBrokersTransactions(rows, 'ib-file').map(tx => ({
      ...tx,
      fx_rate: 1,
      price_gbp: tx.price,
      value_gbp: tx.total,
      fee_gbp: tx.fee,
      grossDividend_gbp: tx.grossDividend ?? null,
      withholdingTax_gbp: tx.withholdingTax ?? null,
      fx_source: 'Native GBP',
      fx_error: null,
      tax_year: getTaxYear(tx.date),
    })) as EnrichedTransaction[]
  }

  it('never reports net dividends above gross for Interactive Brokers withholding', () => {
    const summary = calculateCGT(parseIB([
      ibRow('Dividend', 'AAPL Cash Dividend USD 0.25 per Share', '25.00'),
      ibRow('Foreign Tax Withholding', 'AAPL US Tax', '-3.75'),
    ])).taxYearSummaries[0]

    expect(summary.totalWithholdingTaxGbp).toBeCloseTo(3.75, 6)
    expect(summary.totalDividendsGbp).toBeCloseTo(21.25, 6)
    expect(summary.totalDividendsGbp).toBeLessThanOrEqual(summary.grossDividendsGbp)
  })

  it('nets an Interactive Brokers withholding reversal against the original', () => {
    // IB reverses withholding with a positive row, then re-withholds the
    // corrected amount
    const summary = calculateCGT(parseIB([
      ibRow('Dividend', 'AAPL Cash Dividend USD 0.25 per Share', '25.00'),
      ibRow('Foreign Tax Withholding', 'AAPL US Tax', '-3.75'),
      ibRow('Foreign Tax Withholding', 'AAPL US Tax', '3.75'),
      ibRow('Foreign Tax Withholding', 'AAPL US Tax', '-3.00'),
    ])).taxYearSummaries[0]

    expect(summary.totalWithholdingTaxGbp).toBeCloseTo(3, 6)
    expect(summary.totalDividendsGbp).toBeCloseTo(22, 6)
  })
})
