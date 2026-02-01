import { describe, it, expect } from 'vitest'
import {
  cgtRateChange2024Feature,
  CGT_RATE_CHANGE_DATE,
  AEA_2024_25,
  CGT_RATES,
} from '../cgtRateChange2024'
import type { TaxYearSummary, DisposalRecord } from '../../../../types/cgt'
import type { EnrichedTransaction } from '../../../../types/transaction'

/**
 * Helper to create a minimal disposal record for testing
 */
function createDisposal(
  id: string,
  date: string,
  gainOrLoss: number
): DisposalRecord {
  return {
    id,
    disposal: {
      id: `tx-${id}`,
      source: 'Test',
      date,
      type: 'SELL',
      symbol: 'TEST',
      currency: 'GBP',
      quantity: 10,
      price: 100,
      total: 1000,
      fee: 0,
      tax_year: '2024/25',
    } as EnrichedTransaction,
    matchings: [],
    proceedsGbp: gainOrLoss > 0 ? 1000 + gainOrLoss : 1000,
    allowableCostsGbp: gainOrLoss > 0 ? 1000 : 1000 - gainOrLoss,
    gainOrLossGbp: gainOrLoss,
    taxYear: '2024/25',
    isIncomplete: false,
  }
}

/**
 * Helper to create a minimal tax year summary for testing
 */
function createSummary(
  taxYear: string,
  netGainOrLoss: number
): TaxYearSummary {
  return {
    taxYear,
    startDate: taxYear === '2024/25' ? '2024-04-06' : '2023-04-06',
    endDate: taxYear === '2024/25' ? '2025-04-05' : '2024-04-05',
    disposals: [],
    totalDisposals: 0,
    totalProceedsGbp: 0,
    totalAllowableCostsGbp: 0,
    totalGainsGbp: Math.max(0, netGainOrLoss),
    totalLossesGbp: Math.min(0, netGainOrLoss),
    netGainOrLossGbp: netGainOrLoss,
    annualExemptAmount: AEA_2024_25,
    taxableGainGbp: Math.max(0, netGainOrLoss - AEA_2024_25),
    totalDividends: 0,
    totalDividendsGbp: 0,
    grossDividendsGbp: 0,
    totalWithholdingTaxGbp: 0,
    dividendAllowance: 500,
    totalInterest: 0,
    totalInterestGbp: 0,
    grossInterestGbp: 0,
    interestWithholdingTaxGbp: 0,
    incompleteDisposals: 0,
  }
}

describe('CGT Rate Change 2024 Feature', () => {
  describe('Constants', () => {
    it('should have correct rate change date', () => {
      expect(CGT_RATE_CHANGE_DATE).toBe('2024-10-30')
    })

    it('should have correct AEA for 2024/25', () => {
      expect(AEA_2024_25).toBe(3000)
    })

    it('should have correct CGT rates', () => {
      expect(CGT_RATES.before).toEqual({ basic: 10, higher: 20 })
      expect(CGT_RATES.after).toEqual({ basic: 18, higher: 24 })
    })
  })

  describe('applies()', () => {
    it('should apply to tax year 2024/25', () => {
      expect(cgtRateChange2024Feature.applies('2024/25')).toBe(true)
    })

    it('should not apply to tax year 2023/24', () => {
      expect(cgtRateChange2024Feature.applies('2023/24')).toBe(false)
    })

    it('should not apply to tax year 2025/26', () => {
      expect(cgtRateChange2024Feature.applies('2025/26')).toBe(false)
    })
  })

  describe('calculate()', () => {
    it('should return null for non-2024/25 tax years', () => {
      const summary = createSummary('2023/24', 5000)
      const result = cgtRateChange2024Feature.calculate(summary, [])
      expect(result).toBeNull()
    })

    it('should return feature data for 2024/25 with correct featureId', () => {
      const summary = createSummary('2024/25', 5000)
      const result = cgtRateChange2024Feature.calculate(summary, [])
      expect(result).not.toBeNull()
      expect(result?.featureId).toBe('cgt-rate-change-2024')
    })

    describe('Disposal splitting', () => {
      it('should correctly split disposals before and after rate change date', () => {
        const summary = createSummary('2024/25', 6000)
        const disposals = [
          createDisposal('1', '2024-05-15', 2000), // Before
          createDisposal('2', '2024-09-20', 1000), // Before
          createDisposal('3', '2024-10-30', 1500), // ON rate change date (after)
          createDisposal('4', '2024-11-15', 1500), // After
        ]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.disposalCountBeforeRateChange).toBe(2)
        expect(result?.disposalCountAfterRateChange).toBe(2)
        expect(result?.gainsBeforeRateChange).toBe(3000) // 2000 + 1000
        expect(result?.gainsAfterRateChange).toBe(3000) // 1500 + 1500
      })

      it('should treat disposal exactly on 30 Oct as "after" period', () => {
        const summary = createSummary('2024/25', 5000)
        const disposals = [createDisposal('1', '2024-10-30', 5000)]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.disposalCountBeforeRateChange).toBe(0)
        expect(result?.disposalCountAfterRateChange).toBe(1)
        expect(result?.gainsBeforeRateChange).toBe(0)
        expect(result?.gainsAfterRateChange).toBe(5000)
      })

      it('should handle all disposals before rate change', () => {
        const summary = createSummary('2024/25', 4000)
        const disposals = [
          createDisposal('1', '2024-05-01', 2000),
          createDisposal('2', '2024-10-29', 2000), // Day before
        ]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.disposalCountBeforeRateChange).toBe(2)
        expect(result?.disposalCountAfterRateChange).toBe(0)
        expect(result?.gainsBeforeRateChange).toBe(4000)
        expect(result?.gainsAfterRateChange).toBe(0)
      })

      it('should handle all disposals after rate change', () => {
        const summary = createSummary('2024/25', 4000)
        const disposals = [
          createDisposal('1', '2024-11-01', 2000),
          createDisposal('2', '2025-02-15', 2000),
        ]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.disposalCountBeforeRateChange).toBe(0)
        expect(result?.disposalCountAfterRateChange).toBe(2)
        expect(result?.gainsBeforeRateChange).toBe(0)
        expect(result?.gainsAfterRateChange).toBe(4000)
      })
    })

    describe('Gains and losses calculation', () => {
      it('should correctly separate gains and losses', () => {
        const summary = createSummary('2024/25', 1500)
        const disposals = [
          createDisposal('1', '2024-06-01', 2000), // Gain before
          createDisposal('2', '2024-07-01', -500), // Loss before
          createDisposal('3', '2024-11-01', 1500), // Gain after
          createDisposal('4', '2024-12-01', -1500), // Loss after
        ]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.gainsBeforeRateChange).toBe(2000)
        expect(result?.lossesBeforeRateChange).toBe(-500)
        expect(result?.netGainOrLossBeforeRateChange).toBe(1500)

        expect(result?.gainsAfterRateChange).toBe(1500)
        expect(result?.lossesAfterRateChange).toBe(-1500)
        expect(result?.netGainOrLossAfterRateChange).toBe(0)

        expect(result?.totalNetGainOrLoss).toBe(1500) // 1500 + 0
      })

      it('should handle net loss scenario', () => {
        const summary = createSummary('2024/25', -2000)
        const disposals = [
          createDisposal('1', '2024-06-01', -1000),
          createDisposal('2', '2024-11-01', -1000),
        ]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.netGainOrLossBeforeRateChange).toBe(-1000)
        expect(result?.netGainOrLossAfterRateChange).toBe(-1000)
        expect(result?.totalNetGainOrLoss).toBe(-2000)
      })
    })

    describe('requiresAdjustment logic', () => {
      it('should NOT require adjustment when all disposals before 30 Oct', () => {
        const summary = createSummary('2024/25', 5000)
        const disposals = [createDisposal('1', '2024-09-15', 5000)]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.requiresAdjustment).toBe(false)
      })

      it('should NOT require adjustment when disposal after 30 Oct but gain <= £3,000 AEA', () => {
        const summary = createSummary('2024/25', 2500)
        const disposals = [createDisposal('1', '2024-11-15', 2500)]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.requiresAdjustment).toBe(false)
      })

      it('should NOT require adjustment when disposal after 30 Oct but gain exactly £3,000 AEA', () => {
        const summary = createSummary('2024/25', 3000)
        const disposals = [createDisposal('1', '2024-11-15', 3000)]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.requiresAdjustment).toBe(false)
      })

      it('should require adjustment when disposal after 30 Oct AND gain > £3,000 AEA', () => {
        const summary = createSummary('2024/25', 5000)
        const disposals = [createDisposal('1', '2024-11-15', 5000)]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.requiresAdjustment).toBe(true)
      })

      it('should require adjustment when disposals in both periods AND total gain > £3,000', () => {
        const summary = createSummary('2024/25', 4500)
        const disposals = [
          createDisposal('1', '2024-09-15', 2000), // Before
          createDisposal('2', '2024-11-15', 2500), // After
        ]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.requiresAdjustment).toBe(true)
      })

      it('should NOT require adjustment when disposals in both periods BUT total gain <= £3,000', () => {
        const summary = createSummary('2024/25', 2000)
        const disposals = [
          createDisposal('1', '2024-09-15', 1000),
          createDisposal('2', '2024-11-15', 1000),
        ]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.requiresAdjustment).toBe(false)
      })

      it('should NOT require adjustment when net loss despite some gains', () => {
        const summary = createSummary('2024/25', -1000)
        const disposals = [
          createDisposal('1', '2024-11-15', 5000), // Gain after
          createDisposal('2', '2024-12-01', -6000), // Loss after
        ]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.requiresAdjustment).toBe(false)
        expect(result?.totalNetGainOrLoss).toBe(-1000)
      })
    })

    describe('Rate information', () => {
      it('should include correct rate information', () => {
        const summary = createSummary('2024/25', 5000)
        const result = cgtRateChange2024Feature.calculate(summary, [])

        expect(result?.rateChangeDate).toBe('2024-10-30')
        expect(result?.oldRates).toEqual({ basic: 10, higher: 20 })
        expect(result?.newRates).toEqual({ basic: 18, higher: 24 })
        expect(result?.annualExemptAmount).toBe(3000)
      })
    })

    describe('Edge cases', () => {
      it('should handle empty disposals array', () => {
        const summary = createSummary('2024/25', 0)
        const result = cgtRateChange2024Feature.calculate(summary, [])

        expect(result?.disposalCountBeforeRateChange).toBe(0)
        expect(result?.disposalCountAfterRateChange).toBe(0)
        expect(result?.gainsBeforeRateChange).toBe(0)
        expect(result?.gainsAfterRateChange).toBe(0)
        expect(result?.requiresAdjustment).toBe(false)
      })

      it('should handle disposal on last day of tax year', () => {
        const summary = createSummary('2024/25', 5000)
        const disposals = [createDisposal('1', '2025-04-05', 5000)]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.disposalCountAfterRateChange).toBe(1)
        expect(result?.requiresAdjustment).toBe(true)
      })

      it('should handle disposal on first day of tax year', () => {
        const summary = createSummary('2024/25', 5000)
        const disposals = [createDisposal('1', '2024-04-06', 5000)]

        const result = cgtRateChange2024Feature.calculate(summary, disposals)

        expect(result?.disposalCountBeforeRateChange).toBe(1)
        expect(result?.requiresAdjustment).toBe(false)
      })
    })
  })
})
