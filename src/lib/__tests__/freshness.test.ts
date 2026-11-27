import { describe, it, expect } from 'vitest'
import { freshnessItems } from '../freshness'
import { HMRC_FIGURES_CHECKED } from '../cgt/figuresChecked'
import { LAST_BUNDLED_MONTH } from '../fx/data/hmrcMonthly'
import { formatIsoDate } from '../../utils/date'

describe('freshnessItems', () => {
  it('names the build date, the last bundled HMRC month and the figures check', () => {
    const [updated, rates, checked] = freshnessItems('2026-03-09')
    expect(updated).toBe('Updated 9 Mar 2026')
    // "Dec 2026" from "2026-12": month and year only
    expect(rates).toBe(`HMRC rates to ${formatIsoDate(`${LAST_BUNDLED_MONTH}-01`, 'short').replace(/^1 /, '')}`)
    expect(rates).toMatch(/^HMRC rates to [A-Z][a-z]{2,3} \d{4}$/)
    expect(checked).toBe(`Figures checked ${formatIsoDate(HMRC_FIGURES_CHECKED, 'short')}`)
  })
})
