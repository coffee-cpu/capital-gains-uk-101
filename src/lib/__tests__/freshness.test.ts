import { describe, it, expect } from 'vitest'
import { freshnessItems, HMRC_RULES_CHECK_LOG_URL } from '../freshness'
import { HMRC_RULES_CHECK_DATE } from '../cgt/hmrcRulesCheck'
import { LAST_BUNDLED_MONTH } from '../fx/data/hmrcMonthly'
import { formatIsoDate } from '../../utils/date'

describe('freshnessItems', () => {
  it('names the build date, the last bundled HMRC month and the HMRC rules check', () => {
    const [updated, rates, check] = freshnessItems('2026-03-09')
    expect(updated).toEqual({ text: 'Updated 9 Mar 2026' })
    // "Dec 2026" from "2026-12": month and year only
    expect(rates.text).toBe(`HMRC rates to ${formatIsoDate(`${LAST_BUNDLED_MONTH}-01`, 'short').replace(/^1 /, '')}`)
    expect(rates.text).toMatch(/^HMRC rates to [A-Z][a-z]{2,3} \d{4}$/)
    expect(check).toEqual({
      text: 'HMRC rules and allowances checked',
      date: formatIsoDate(HMRC_RULES_CHECK_DATE, 'short'),
      href: HMRC_RULES_CHECK_LOG_URL,
    })
  })

  it('links to the rules check log in the repository', () => {
    expect(HMRC_RULES_CHECK_LOG_URL).toMatch(/\/blob\/main\/docs\/HMRC_RULES_CHECK\.md#checks$/)
  })
})
