import { describe, it, expect } from 'vitest'
import {
  getApplicableFeatures,
  calculateTaxYearFeatures,
} from '../registry'
import { cgtRateChange2024Feature } from '../cgtRateChange2024'
import type { TaxYearSummary, DisposalRecord } from '../../../../types/cgt'
import type { CGTRateChange2024Data } from '../cgtRateChange2024'

/**
 * Helper to create a minimal tax year summary for testing
 */
function createSummary(taxYear: string): TaxYearSummary {
  return {
    taxYear,
    startDate: taxYear === '2024/25' ? '2024-04-06' : '2023-04-06',
    endDate: taxYear === '2024/25' ? '2025-04-05' : '2024-04-05',
    disposals: [],
    totalDisposals: 0,
    totalProceedsGbp: 0,
    totalAllowableCostsGbp: 0,
    totalGainsGbp: 0,
    totalLossesGbp: 0,
    netGainOrLossGbp: 0,
    annualExemptAmount: 3000,
    taxableGainGbp: 0,
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

describe('Tax Year Features Registry', () => {
  describe('getApplicableFeatures()', () => {
    it('should return CGT rate change feature for 2024/25', () => {
      const features = getApplicableFeatures('2024/25')
      expect(features).toHaveLength(1)
      expect(features[0]).toBe(cgtRateChange2024Feature)
    })

    it('should return empty array for 2023/24', () => {
      const features = getApplicableFeatures('2023/24')
      expect(features).toHaveLength(0)
    })

    it('should return empty array for 2025/26', () => {
      const features = getApplicableFeatures('2025/26')
      expect(features).toHaveLength(0)
    })
  })

  describe('calculateTaxYearFeatures()', () => {
    it('should calculate and return features for 2024/25', () => {
      const summary = createSummary('2024/25')
      const features = calculateTaxYearFeatures(summary, [])

      expect(Object.keys(features)).toContain('cgt-rate-change-2024')
      expect(features['cgt-rate-change-2024']).toHaveProperty('featureId', 'cgt-rate-change-2024')
    })

    it('should return empty object for tax years without features', () => {
      const summary = createSummary('2023/24')
      const features = calculateTaxYearFeatures(summary, [])

      expect(Object.keys(features)).toHaveLength(0)
    })

    it('should pass disposals to feature calculations', () => {
      const summary = createSummary('2024/25')
      summary.netGainOrLossGbp = 5000
      summary.totalGainsGbp = 5000

      const disposal = {
        id: 'disposal-1',
        disposal: {
          id: 'tx-1',
          source: 'Test',
          date: '2024-11-15',
          type: 'SELL' as const,
          symbol: 'TEST',
          currency: 'GBP',
          quantity: 10,
          price: 100,
          total: 1000,
          fee: 0,
          tax_year: '2024/25',
        },
        matchings: [],
        proceedsGbp: 1000,
        allowableCostsGbp: 500,
        gainOrLossGbp: 5000,
        taxYear: '2024/25',
        isIncomplete: false,
      }

      const features = calculateTaxYearFeatures(summary, [disposal as unknown as DisposalRecord])
      const rateChangeData = features['cgt-rate-change-2024'] as CGTRateChange2024Data

      expect(rateChangeData.disposalCountAfterRateChange).toBe(1)
      expect(rateChangeData.gainsAfterRateChange).toBe(5000)
    })
  })
})
