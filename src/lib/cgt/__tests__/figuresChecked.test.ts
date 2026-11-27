import { describe, it, expect } from 'vitest'
import {
  FIGURES_CHECKED_FROM_TAX_YEAR,
  HMRC_FIGURES_CHECKED,
  areFiguresCheckedFor,
  figuresCheckedThroughTaxYear,
} from '../figuresChecked'
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

  it('covers tax years from the earliest checked one up to the one the check was done in', () => {
    const checkedYear = figuresCheckedThroughTaxYear()
    expect(checkedYear).toBe(getTaxYear(HMRC_FIGURES_CHECKED))
    expect(areFiguresCheckedFor(checkedYear)).toBe(true)
    expect(areFiguresCheckedFor(shiftTaxYear(checkedYear, -1))).toBe(true)
    expect(areFiguresCheckedFor(FIGURES_CHECKED_FROM_TAX_YEAR)).toBe(true)
  })

  it('does not cover tax years older than the checked tables', () => {
    expect(areFiguresCheckedFor(shiftTaxYear(FIGURES_CHECKED_FROM_TAX_YEAR, -1))).toBe(false)
    expect(areFiguresCheckedFor('2014/15')).toBe(false)
  })

  it('does not cover a tax year that starts after the check', () => {
    expect(areFiguresCheckedFor(shiftTaxYear(figuresCheckedThroughTaxYear(), 1))).toBe(false)
  })
})
