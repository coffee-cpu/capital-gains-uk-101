import { describe, it, expect } from 'vitest'
import { HMRC_AUDIT_DATE, hmrcAuditTaxYear, isAfterHmrcAudit } from '../hmrcAudit'
import { getTaxYear } from '../../../utils/taxYear'

/** The tax year n years after the given one, e.g. ("2026/27", 1) -> "2027/28" */
function shiftTaxYear(taxYear: string, n: number): string {
  const start = parseInt(taxYear.split('/')[0]) + n
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`
}

describe('hmrcAudit', () => {
  it('records the audit as an ISO date that has passed', () => {
    expect(HMRC_AUDIT_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Local date, so a check recorded just after midnight in British Summer Time passes
    expect(HMRC_AUDIT_DATE <= new Date().toLocaleDateString('en-CA')).toBe(true)
  })

  it('names the tax year the audit was done in', () => {
    expect(hmrcAuditTaxYear()).toBe(getTaxYear(HMRC_AUDIT_DATE))
  })

  it('flags only tax years that start after the audit', () => {
    const checkedYear = hmrcAuditTaxYear()
    expect(isAfterHmrcAudit(shiftTaxYear(checkedYear, 1))).toBe(true)
    expect(isAfterHmrcAudit(checkedYear)).toBe(false)
    expect(isAfterHmrcAudit(shiftTaxYear(checkedYear, -1))).toBe(false)
    expect(isAfterHmrcAudit('2014/15')).toBe(false)
  })
})
