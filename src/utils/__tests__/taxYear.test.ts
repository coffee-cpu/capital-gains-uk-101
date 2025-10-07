import { describe, it, expect } from 'vitest'
import { getTaxYear, getTaxYearStart, getTaxYearEnd } from '../taxYear'

describe('taxYear utilities', () => {
  describe('getTaxYear', () => {
    it('should return correct tax year for date after 6 April', () => {
      expect(getTaxYear('2024-04-06')).toBe('2024/25')
      expect(getTaxYear('2024-07-15')).toBe('2024/25')
      expect(getTaxYear('2024-12-31')).toBe('2024/25')
    })

    it('should return correct tax year for date before 6 April', () => {
      expect(getTaxYear('2024-04-05')).toBe('2023/24')
      expect(getTaxYear('2024-01-01')).toBe('2023/24')
      expect(getTaxYear('2024-03-31')).toBe('2023/24')
    })

    it('should handle boundary date of 6 April correctly', () => {
      expect(getTaxYear('2024-04-06')).toBe('2024/25')
      expect(getTaxYear('2024-04-05')).toBe('2023/24')
    })

    it('should handle different years', () => {
      expect(getTaxYear('2023-06-15')).toBe('2023/24')
      expect(getTaxYear('2025-06-15')).toBe('2025/26')
      expect(getTaxYear('2022-02-01')).toBe('2021/22')
    })

    it('should work with Date objects', () => {
      const date = new Date('2024-07-15')
      expect(getTaxYear(date)).toBe('2024/25')
    })

    it('should format year suffix correctly', () => {
      expect(getTaxYear('2024-06-01')).toBe('2024/25')
      expect(getTaxYear('2009-06-01')).toBe('2009/10')
      // 2099/2100 would give "00" suffix which is expected behavior
      expect(getTaxYear('2099-06-01')).toBe('2099/00')
    })
  })

  describe('getTaxYearStart', () => {
    it('should return correct start date for tax year', () => {
      expect(getTaxYearStart('2024/25')).toBe('2024-04-06')
      expect(getTaxYearStart('2023/24')).toBe('2023-04-06')
      expect(getTaxYearStart('2025/26')).toBe('2025-04-06')
    })

    it('should handle different tax year formats', () => {
      expect(getTaxYearStart('2020/21')).toBe('2020-04-06')
      expect(getTaxYearStart('2010/11')).toBe('2010-04-06')
    })
  })

  describe('getTaxYearEnd', () => {
    it('should return correct end date for tax year', () => {
      expect(getTaxYearEnd('2024/25')).toBe('2025-04-05')
      expect(getTaxYearEnd('2023/24')).toBe('2024-04-05')
      expect(getTaxYearEnd('2025/26')).toBe('2026-04-05')
    })

    it('should handle different tax year formats', () => {
      expect(getTaxYearEnd('2020/21')).toBe('2021-04-05')
      expect(getTaxYearEnd('2010/11')).toBe('2011-04-05')
    })
  })

  describe('tax year integration', () => {
    it('should work correctly for full tax year cycle', () => {
      const taxYear = '2024/25'
      const start = getTaxYearStart(taxYear)
      const end = getTaxYearEnd(taxYear)

      expect(getTaxYear(start)).toBe(taxYear)
      expect(getTaxYear(end)).toBe(taxYear)

      // Day before start should be previous tax year
      expect(getTaxYear('2024-04-05')).toBe('2023/24')

      // Day after end should be next tax year
      expect(getTaxYear('2025-04-06')).toBe('2025/26')
    })
  })
})
