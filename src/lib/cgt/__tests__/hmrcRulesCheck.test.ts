import { describe, it, expect } from 'vitest'
import { HMRC_RULES_CHECK_DATE, hmrcRulesCheckTaxYear, isAfterHmrcRulesCheck } from '../hmrcRulesCheck'
import { getTaxYear } from '../../../utils/taxYear'

/** The tax year n years after the given one, e.g. ("2026/27", 1) -> "2027/28" */
function shiftTaxYear(taxYear: string, n: number): string {
  const start = parseInt(taxYear.split('/')[0]) + n
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`
}

describe('hmrcRulesCheck', () => {
  it('records the check as an ISO date that has passed', () => {
    expect(HMRC_RULES_CHECK_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Local date, so a check recorded just after midnight in British Summer Time passes
    expect(HMRC_RULES_CHECK_DATE <= new Date().toLocaleDateString('en-CA')).toBe(true)
  })

  it('names the tax year the check was done in', () => {
    expect(hmrcRulesCheckTaxYear()).toBe(getTaxYear(HMRC_RULES_CHECK_DATE))
  })

  it('flags only tax years that start after the check', () => {
    const checkedYear = hmrcRulesCheckTaxYear()
    expect(isAfterHmrcRulesCheck(shiftTaxYear(checkedYear, 1))).toBe(true)
    expect(isAfterHmrcRulesCheck(checkedYear)).toBe(false)
    expect(isAfterHmrcRulesCheck(shiftTaxYear(checkedYear, -1))).toBe(false)
    expect(isAfterHmrcRulesCheck('2014/15')).toBe(false)
  })
})
