import { describe, it, expect } from 'vitest'
import { HMRC_FIGURES_CHECKED, figuresCheckedTaxYear, isAfterFiguresCheck } from '../figuresChecked'
import { getTaxYear } from '../../../utils/taxYear'

/** The tax year n years after the given one, e.g. ("2026/27", 1) -> "2027/28" */
function shiftTaxYear(taxYear: string, n: number): string {
  const start = parseInt(taxYear.split('/')[0]) + n
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`
}

describe('figuresChecked', () => {
  it('records the check as an ISO date that has passed', () => {
    expect(HMRC_FIGURES_CHECKED).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Local date, so a check recorded just after midnight in British Summer Time passes
    expect(HMRC_FIGURES_CHECKED <= new Date().toLocaleDateString('en-CA')).toBe(true)
  })

  it('names the tax year the check was done in', () => {
    expect(figuresCheckedTaxYear()).toBe(getTaxYear(HMRC_FIGURES_CHECKED))
  })

  it('flags only tax years that start after the check', () => {
    const checkedYear = figuresCheckedTaxYear()
    expect(isAfterFiguresCheck(shiftTaxYear(checkedYear, 1))).toBe(true)
    expect(isAfterFiguresCheck(checkedYear)).toBe(false)
    expect(isAfterFiguresCheck(shiftTaxYear(checkedYear, -1))).toBe(false)
    expect(isAfterFiguresCheck('2014/15')).toBe(false)
  })
})
