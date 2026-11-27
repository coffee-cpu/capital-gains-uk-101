import { describe, it, expect } from 'vitest'
import { HMRC_RULES_CHECK_DATE, isConfirmedByHmrcRulesCheck, lastEndedTaxYear } from '../hmrcRulesCheck'

describe('hmrcRulesCheck', () => {
  it('records the check as an ISO date that has passed', () => {
    expect(HMRC_RULES_CHECK_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Local date, so a check recorded just after midnight in British Summer Time passes
    expect(HMRC_RULES_CHECK_DATE <= new Date().toLocaleDateString('en-CA')).toBe(true)
  })

  it('names the last tax year to have ended', () => {
    expect(lastEndedTaxYear('2026-11-27')).toBe('2025/26')
    expect(lastEndedTaxYear('2027-04-05')).toBe('2025/26')
    expect(lastEndedTaxYear('2027-04-06')).toBe('2026/27')
    expect(lastEndedTaxYear('2000-01-01')).toBe('1998/99')
  })

  it('confirms only the tax years that had ended by the check', () => {
    const checked = lastEndedTaxYear(HMRC_RULES_CHECK_DATE)
    const underWay = lastEndedTaxYear(`${parseInt(HMRC_RULES_CHECK_DATE.slice(0, 4)) + 1}-${HMRC_RULES_CHECK_DATE.slice(5)}`)
    expect(isConfirmedByHmrcRulesCheck(checked)).toBe(true)
    expect(isConfirmedByHmrcRulesCheck('2014/15')).toBe(true)
    // The year the check was done in can still change
    expect(isConfirmedByHmrcRulesCheck(underWay)).toBe(false)
  })
})
