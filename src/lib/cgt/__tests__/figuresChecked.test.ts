import { describe, it, expect } from 'vitest'
import { HMRC_FIGURES_CHECKED, areFiguresCheckedFor, figuresCheckedThroughTaxYear } from '../figuresChecked'
import { getTaxYear } from '../../../utils/taxYear'

/** The tax year n years after the given one, e.g. ("2026/27", 1) -> "2027/28" */
function shiftTaxYear(taxYear: string, n: number): string {
  const start = parseInt(taxYear.split('/')[0]) + n
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`
}

describe('figuresChecked', () => {
  it('records the check as an ISO date that has passed', () => {
    expect(HMRC_FIGURES_CHECKED).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(HMRC_FIGURES_CHECKED <= new Date().toISOString().slice(0, 10)).toBe(true)
  })

  it('covers tax years up to the one the check was done in', () => {
    const checkedYear = figuresCheckedThroughTaxYear()
    expect(checkedYear).toBe(getTaxYear(HMRC_FIGURES_CHECKED))
    expect(areFiguresCheckedFor(checkedYear)).toBe(true)
    expect(areFiguresCheckedFor(shiftTaxYear(checkedYear, -1))).toBe(true)
    expect(areFiguresCheckedFor('2014/15')).toBe(true)
  })

  it('does not cover a tax year that starts after the check', () => {
    expect(areFiguresCheckedFor(shiftTaxYear(figuresCheckedThroughTaxYear(), 1))).toBe(false)
  })
})
