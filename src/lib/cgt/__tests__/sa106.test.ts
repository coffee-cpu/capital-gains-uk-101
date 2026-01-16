import { describe, it, expect } from 'vitest'
import { calculateCGT } from '../engine'
import { EnrichedTransaction } from '../../../types/transaction'

/**
 * SA106 Integration Tests
 *
 * These tests verify the complete SA106 (Foreign Income) workflow:
 * 1. Gross dividend and withholding tax fields flow through the system
 * 2. Tax year summaries correctly aggregate SA106 data
 * 3. Multiple dividend sources are combined correctly
 */

describe('SA106 Foreign Income', () => {
  describe('grossDividendsGbp and totalWithholdingTaxGbp calculation', () => {
    it('should calculate SA106 fields for dividends with withholding tax', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'div-1',
          source: 'Charles Schwab',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 85, // Net after withholding
          fee: null,
          notes: 'Dividend with NRA Tax Adj',
          fx_rate: 1.25,
          price_gbp: null,
          value_gbp: 68, // 85 / 1.25
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          // SA106 fields
          grossDividend: 100,
          withholdingTax: 15,
          grossDividend_gbp: 80, // 100 / 1.25
          withholdingTax_gbp: 12, // 15 / 1.25
        },
      ]

      const result = calculateCGT(transactions)

      expect(result.taxYearSummaries).toHaveLength(1)

      const summary = result.taxYearSummaries[0]
      expect(summary.taxYear).toBe('2024/25')
      expect(summary.totalDividends).toBe(1)
      // SA106 specific fields
      expect(summary.grossDividendsGbp).toBe(80)
      expect(summary.totalWithholdingTaxGbp).toBe(12)
    })

    it('should aggregate multiple dividends with withholding tax', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'div-1',
          source: 'Charles Schwab',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 85,
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 85,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 100,
          withholdingTax: 15,
          grossDividend_gbp: 100,
          withholdingTax_gbp: 15,
        },
        {
          id: 'div-2',
          source: 'Charles Schwab',
          symbol: 'MSFT',
          name: 'Microsoft Corp.',
          date: '2024-07-20',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 170,
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 170,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 200,
          withholdingTax: 30,
          grossDividend_gbp: 200,
          withholdingTax_gbp: 30,
        },
        {
          id: 'div-3',
          source: 'Charles Schwab',
          symbol: 'GOOGL',
          name: 'Alphabet Inc.',
          date: '2024-08-10',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 42.50,
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 42.50,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 50,
          withholdingTax: 7.50,
          grossDividend_gbp: 50,
          withholdingTax_gbp: 7.50,
        },
      ]

      const result = calculateCGT(transactions)

      const summary = result.taxYearSummaries[0]
      expect(summary.totalDividends).toBe(3)
      // Sum of all gross dividends: 100 + 200 + 50 = 350
      expect(summary.grossDividendsGbp).toBe(350)
      // Sum of all withholding tax: 15 + 30 + 7.50 = 52.50
      expect(summary.totalWithholdingTaxGbp).toBe(52.50)
    })

    it('should handle dividends without withholding tax (UK dividends)', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'div-1',
          source: 'Freetrade',
          symbol: 'VOD.L',
          name: 'Vodafone',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'GBP',
          total: 50, // UK dividend - no withholding
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 50,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          // No SA106 fields for UK dividends
          grossDividend: null,
          withholdingTax: null,
          grossDividend_gbp: null,
          withholdingTax_gbp: null,
        },
      ]

      const result = calculateCGT(transactions)

      const summary = result.taxYearSummaries[0]
      expect(summary.totalDividends).toBe(1)
      expect(summary.totalDividendsGbp).toBe(50)
      // When grossDividend_gbp is null, fallback to value_gbp
      expect(summary.grossDividendsGbp).toBe(50)
      expect(summary.totalWithholdingTaxGbp).toBe(0)
    })

    it('should handle mixed UK and foreign dividends', () => {
      const transactions: EnrichedTransaction[] = [
        // UK dividend - no withholding
        {
          id: 'div-uk',
          source: 'Freetrade',
          symbol: 'LLOY.L',
          name: 'Lloyds Banking',
          date: '2024-05-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'GBP',
          total: 100,
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 100,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: null,
          withholdingTax: null,
          grossDividend_gbp: null,
          withholdingTax_gbp: null,
        },
        // US dividend - with 15% withholding
        {
          id: 'div-us',
          source: 'Charles Schwab',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 85,
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 85,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 100,
          withholdingTax: 15,
          grossDividend_gbp: 100,
          withholdingTax_gbp: 15,
        },
      ]

      const result = calculateCGT(transactions)

      const summary = result.taxYearSummaries[0]
      expect(summary.totalDividends).toBe(2)
      // Total dividends received: 100 (UK) + 85 (US net) = 185
      expect(summary.totalDividendsGbp).toBe(185)
      // Gross dividends: 100 (UK, using value_gbp) + 100 (US gross) = 200
      expect(summary.grossDividendsGbp).toBe(200)
      // Withholding tax: 0 (UK) + 15 (US) = 15
      expect(summary.totalWithholdingTaxGbp).toBe(15)
    })

    it('should handle dividends across multiple tax years', () => {
      const transactions: EnrichedTransaction[] = [
        // 2023/24 dividend
        {
          id: 'div-2023',
          source: 'Charles Schwab',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2023-10-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 170,
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 170,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2023/24',
          gain_group: 'NONE',
          grossDividend: 200,
          withholdingTax: 30,
          grossDividend_gbp: 200,
          withholdingTax_gbp: 30,
        },
        // 2024/25 dividend
        {
          id: 'div-2024',
          source: 'Charles Schwab',
          symbol: 'MSFT',
          name: 'Microsoft Corp.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 85,
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 85,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 100,
          withholdingTax: 15,
          grossDividend_gbp: 100,
          withholdingTax_gbp: 15,
        },
      ]

      const result = calculateCGT(transactions)

      expect(result.taxYearSummaries).toHaveLength(2)

      const summary2023 = result.taxYearSummaries.find(s => s.taxYear === '2023/24')!
      expect(summary2023.grossDividendsGbp).toBe(200)
      expect(summary2023.totalWithholdingTaxGbp).toBe(30)

      const summary2024 = result.taxYearSummaries.find(s => s.taxYear === '2024/25')!
      expect(summary2024.grossDividendsGbp).toBe(100)
      expect(summary2024.totalWithholdingTaxGbp).toBe(15)
    })

    it('should handle zero withholding tax correctly', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'div-1',
          source: 'Interactive Brokers',
          symbol: 'VWRL.L',
          name: 'Vanguard All-World',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'GBP',
          total: 50,
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 50,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 50,
          withholdingTax: 0, // Explicitly zero
          grossDividend_gbp: 50,
          withholdingTax_gbp: 0,
        },
      ]

      const result = calculateCGT(transactions)

      const summary = result.taxYearSummaries[0]
      expect(summary.grossDividendsGbp).toBe(50)
      expect(summary.totalWithholdingTaxGbp).toBe(0)
    })
  })

  describe('SA106 with CGT calculations', () => {
    it('should calculate SA106 fields alongside CGT for same tax year', () => {
      const transactions: EnrichedTransaction[] = [
        // BUY transaction
        {
          id: 'buy-1',
          source: 'Charles Schwab',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-05-01',
          type: 'BUY',
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
        // SELL transaction
        {
          id: 'sell-1',
          source: 'Charles Schwab',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-05-01',
          type: 'SELL',
          quantity: 10,
          price: 180,
          currency: 'USD',
          total: 1800,
          fee: 10,
          notes: null,
          fx_rate: 1.0,
          price_gbp: 180,
          value_gbp: 1800,
          fee_gbp: 10,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
        },
        // DIVIDEND with withholding
        {
          id: 'div-1',
          source: 'Charles Schwab',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 85,
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 85,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 100,
          withholdingTax: 15,
          grossDividend_gbp: 100,
          withholdingTax_gbp: 15,
        },
      ]

      const result = calculateCGT(transactions)

      expect(result.taxYearSummaries).toHaveLength(1)
      expect(result.disposals).toHaveLength(1)

      const summary = result.taxYearSummaries[0]

      // CGT calculations
      expect(summary.totalDisposals).toBe(1)
      expect(summary.netGainOrLossGbp).toBe(280) // (1800-10) - (1500+10)
      expect(summary.annualExemptAmount).toBe(3000)
      expect(summary.taxableGainGbp).toBe(0) // Below threshold

      // SA106 calculations
      expect(summary.totalDividends).toBe(1)
      expect(summary.totalDividendsGbp).toBe(85)
      expect(summary.grossDividendsGbp).toBe(100)
      expect(summary.totalWithholdingTaxGbp).toBe(15)
    })
  })

  describe('broker-specific SA106 handling', () => {
    it('should handle Schwab NRA Tax Adj pattern (dividend with linked withholding)', () => {
      // Simulates what the Schwab parser produces after linking NRA Tax Adj
      const transactions: EnrichedTransaction[] = [
        {
          id: 'schwab-div-1',
          source: 'Charles Schwab',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 72.25, // Net = Gross - Withholding
          fee: null,
          notes: 'Cash Dividend',
          fx_rate: 1.25,
          price_gbp: null,
          value_gbp: 57.80, // 72.25 / 1.25
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 85, // From original dividend row
          withholdingTax: 12.75, // 15% of 85
          grossDividend_gbp: 68, // 85 / 1.25
          withholdingTax_gbp: 10.20, // 12.75 / 1.25
        },
      ]

      const result = calculateCGT(transactions)

      const summary = result.taxYearSummaries[0]
      expect(summary.grossDividendsGbp).toBe(68)
      expect(summary.totalWithholdingTaxGbp).toBe(10.20)
      // Net should be gross - withholding
      expect(summary.grossDividendsGbp - summary.totalWithholdingTaxGbp).toBeCloseTo(57.80, 1)
    })

    it('should handle Trading 212 pattern (total is net, withholding separate)', () => {
      // Trading 212: total = net dividend, withholding in separate column
      const transactions: EnrichedTransaction[] = [
        {
          id: 't212-div-1',
          source: 'Trading 212',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'GBP',
          total: 15.75, // Net amount
          fee: null,
          notes: 'Gross: 18.11 GBP, Tax withheld: 2.36 GBP',
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 15.75,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 18.11, // Calculated: net + withholding
          withholdingTax: 2.36,
          grossDividend_gbp: 18.11,
          withholdingTax_gbp: 2.36,
        },
      ]

      const result = calculateCGT(transactions)

      const summary = result.taxYearSummaries[0]
      expect(summary.grossDividendsGbp).toBe(18.11)
      expect(summary.totalWithholdingTaxGbp).toBe(2.36)
    })

    it('should handle Interactive Brokers pattern (gross and net separate)', () => {
      // IB: gross in one column, net in another, withholding = gross - net
      const transactions: EnrichedTransaction[] = [
        {
          id: 'ib-div-1',
          source: 'Interactive Brokers',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 85, // Gross amount
          fee: null,
          notes: null,
          fx_rate: 1.25,
          price_gbp: null,
          value_gbp: 68, // 85 / 1.25
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 100,
          withholdingTax: 15, // Calculated from gross - net
          grossDividend_gbp: 80,
          withholdingTax_gbp: 12,
        },
      ]

      const result = calculateCGT(transactions)

      const summary = result.taxYearSummaries[0]
      expect(summary.grossDividendsGbp).toBe(80)
      expect(summary.totalWithholdingTaxGbp).toBe(12)
    })

    it('should handle Freetrade pattern (gross amount, withheld in fee)', () => {
      // Freetrade: provides gross amount and withholding in separate field
      const transactions: EnrichedTransaction[] = [
        {
          id: 'ft-div-1',
          source: 'Freetrade',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 5.50, // Total in Freetrade is gross
          fee: null, // No fee - withholding in dedicated field
          notes: null,
          fx_rate: 1.25,
          price_gbp: null,
          value_gbp: 4.40,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 5.50,
          withholdingTax: 0.83, // 15% of 5.50
          grossDividend_gbp: 4.40,
          withholdingTax_gbp: 0.66,
        },
      ]

      const result = calculateCGT(transactions)

      const summary = result.taxYearSummaries[0]
      expect(summary.grossDividendsGbp).toBe(4.40)
      expect(summary.totalWithholdingTaxGbp).toBe(0.66)
    })
  })

  describe('edge cases', () => {
    it('should handle tax year with only dividends (no CGT disposals)', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'div-1',
          source: 'Charles Schwab',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 85,
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 85,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 100,
          withholdingTax: 15,
          grossDividend_gbp: 100,
          withholdingTax_gbp: 15,
        },
      ]

      const result = calculateCGT(transactions)

      const summary = result.taxYearSummaries[0]
      // No CGT
      expect(summary.totalDisposals).toBe(0)
      expect(summary.netGainOrLossGbp).toBe(0)
      expect(summary.taxableGainGbp).toBe(0)

      // SA106 fields should still be populated
      expect(summary.grossDividendsGbp).toBe(100)
      expect(summary.totalWithholdingTaxGbp).toBe(15)
    })

    it('should handle ignored dividends', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'div-1',
          source: 'Charles Schwab',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 85,
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 85,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 100,
          withholdingTax: 15,
          grossDividend_gbp: 100,
          withholdingTax_gbp: 15,
          ignored: true, // Marked as ignored
        },
        {
          id: 'div-2',
          source: 'Charles Schwab',
          symbol: 'MSFT',
          name: 'Microsoft Corp.',
          date: '2024-07-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 42.50,
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 42.50,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 50,
          withholdingTax: 7.50,
          grossDividend_gbp: 50,
          withholdingTax_gbp: 7.50,
        },
      ]

      const result = calculateCGT(transactions)

      const summary = result.taxYearSummaries[0]
      // Only non-ignored dividend should count
      expect(summary.totalDividends).toBe(1)
      expect(summary.grossDividendsGbp).toBe(50)
      expect(summary.totalWithholdingTaxGbp).toBe(7.50)
    })

    it('should handle very small withholding amounts', () => {
      const transactions: EnrichedTransaction[] = [
        {
          id: 'div-1',
          source: 'Charles Schwab',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2024-06-15',
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 0.85,
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 0.85,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE',
          grossDividend: 1.00,
          withholdingTax: 0.15,
          grossDividend_gbp: 1.00,
          withholdingTax_gbp: 0.15,
        },
      ]

      const result = calculateCGT(transactions)

      const summary = result.taxYearSummaries[0]
      expect(summary.grossDividendsGbp).toBe(1.00)
      expect(summary.totalWithholdingTaxGbp).toBe(0.15)
    })

    it('should handle large number of dividend transactions', () => {
      // Simulate 12 monthly dividends
      const transactions: EnrichedTransaction[] = []
      for (let month = 1; month <= 12; month++) {
        const date = `2024-${month.toString().padStart(2, '0')}-15`
        const taxYear = month < 4 ? '2023/24' : '2024/25'
        transactions.push({
          id: `div-${month}`,
          source: 'Charles Schwab',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date,
          type: 'DIVIDEND',
          quantity: null,
          price: null,
          currency: 'USD',
          total: 85,
          fee: null,
          notes: null,
          fx_rate: 1.0,
          price_gbp: null,
          value_gbp: 85,
          fee_gbp: null,
          fx_source: 'HMRC',
          fx_error: null,
          tax_year: taxYear,
          gain_group: 'NONE',
          grossDividend: 100,
          withholdingTax: 15,
          grossDividend_gbp: 100,
          withholdingTax_gbp: 15,
        })
      }

      const result = calculateCGT(transactions)

      // Should have 2 tax years
      expect(result.taxYearSummaries).toHaveLength(2)

      // 2023/24: Jan, Feb, Mar = 3 dividends
      const summary2023 = result.taxYearSummaries.find(s => s.taxYear === '2023/24')!
      expect(summary2023.totalDividends).toBe(3)
      expect(summary2023.grossDividendsGbp).toBe(300) // 3 × 100
      expect(summary2023.totalWithholdingTaxGbp).toBe(45) // 3 × 15

      // 2024/25: Apr through Dec = 9 dividends
      const summary2024 = result.taxYearSummaries.find(s => s.taxYear === '2024/25')!
      expect(summary2024.totalDividends).toBe(9)
      expect(summary2024.grossDividendsGbp).toBe(900) // 9 × 100
      expect(summary2024.totalWithholdingTaxGbp).toBe(135) // 9 × 15
    })
  })
})
