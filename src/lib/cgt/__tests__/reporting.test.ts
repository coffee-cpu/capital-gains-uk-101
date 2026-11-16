import { describe, it, expect } from 'vitest'
import { getReportingProceedsLimit, sa108ReportingNeed } from '../reporting'

function year(taxYear: string, overrides: Partial<Parameters<typeof sa108ReportingNeed>[0]> = {}) {
  return {
    taxYear,
    totalProceedsGbp: 10_000,
    totalGainsGbp: 0,
    netGainOrLossGbp: 0,
    annualExemptAmount: 3_000,
    taxableGainGbp: 0,
    ...overrides,
  }
}

describe('getReportingProceedsLimit', () => {
  it('is a fixed £50,000 from 2023/24 (SA108 Notes 2023-24 to 2025-26)', () => {
    expect(getReportingProceedsLimit('2023/24')).toBe(50_000)
    expect(getReportingProceedsLimit('2024/25')).toBe(50_000)
    expect(getReportingProceedsLimit('2025/26')).toBe(50_000)
  })

  it('was 4 times the annual exempt amount before 2023/24', () => {
    expect(getReportingProceedsLimit('2022/23')).toBe(49_200)
    expect(getReportingProceedsLimit('2019/20')).toBe(48_000)
  })
})

describe('sa108ReportingNeed', () => {
  it('needs nothing for small disposals with no gain', () => {
    expect(sa108ReportingNeed(year('2024/25'))).toEqual({
      taxDue: false,
      proceedsOverLimit: false,
      gainsOverExemptAmount: false,
      hasLossToClaim: false,
      proceedsLimit: 50_000,
    })
  })

  it('needs the pages when proceeds are over £50,000 even with no tax due', () => {
    const need = sa108ReportingNeed(year('2024/25', { totalProceedsGbp: 50_000.01, totalGainsGbp: 1_000, netGainOrLossGbp: 1_000 }))
    expect(need.taxDue).toBe(false)
    expect(need.proceedsOverLimit).toBe(true)
  })

  it('does not count proceeds of exactly the limit', () => {
    expect(sa108ReportingNeed(year('2024/25', { totalProceedsGbp: 50_000 })).proceedsOverLimit).toBe(false)
  })

  it('counts gains before losses against the annual exempt amount', () => {
    // £5,000 of gains and £4,000 of losses: £1,000 net, nothing taxable, still reported
    const need = sa108ReportingNeed(year('2024/25', { totalGainsGbp: 5_000, netGainOrLossGbp: 1_000 }))
    expect(need.taxDue).toBe(false)
    expect(need.gainsOverExemptAmount).toBe(true)
  })

  it('flags tax due and a loss to claim', () => {
    expect(sa108ReportingNeed(year('2024/25', { totalGainsGbp: 8_000, netGainOrLossGbp: 8_000, taxableGainGbp: 5_000 })).taxDue).toBe(true)
    expect(sa108ReportingNeed(year('2024/25', { netGainOrLossGbp: -200 })).hasLossToClaim).toBe(true)
  })
})
