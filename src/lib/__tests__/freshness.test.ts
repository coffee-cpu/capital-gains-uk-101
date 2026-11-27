import { describe, it, expect } from 'vitest'
import { freshnessItems, hmrcRulesBadge, HMRC_RULES_BADGE_MAX_AGE_DAYS, HMRC_RULES_CHECK_LOG_URL } from '../freshness'
import { HMRC_RULES_CHECK_DATE, lastEndedTaxYear } from '../cgt/hmrcRulesCheck'
import { LAST_BUNDLED_MONTH } from '../fx/data/hmrcMonthly'
import { formatIsoDate } from '../../utils/date'

const checkedOn = formatIsoDate(HMRC_RULES_CHECK_DATE, 'short')
/** The same day n years after the check */
function yearsAfterCheck(n: number): string {
  return `${parseInt(HMRC_RULES_CHECK_DATE.slice(0, 4)) + n}${HMRC_RULES_CHECK_DATE.slice(4)}`
}

describe('freshnessItems', () => {
  it('names the build date and the last bundled HMRC month', () => {
    const [updated, rates] = freshnessItems('2026-03-09', HMRC_RULES_CHECK_DATE)
    expect(updated).toEqual({ text: 'Updated 9 Mar 2026' })
    // "Dec 2026" from "2026-12": month and year only
    expect(rates.text).toBe(`HMRC rates to ${formatIsoDate(`${LAST_BUNDLED_MONTH}-01`, 'short').replace(/^1 /, '')}`)
    expect(rates.text).toMatch(/^HMRC rates to [A-Z][a-z]{2,3} \d{4}$/)
  })

  it('says the last ended tax year is up to date when the check came after it', () => {
    const [, , check] = freshnessItems('2026-03-09', HMRC_RULES_CHECK_DATE)
    expect(check).toEqual({
      text: `Up to date with HMRC rules for ${lastEndedTaxYear(HMRC_RULES_CHECK_DATE)}`,
      date: { label: 'checked', value: checkedOn, href: HMRC_RULES_CHECK_LOG_URL },
    })
  })

  it('says a tax year that ended after the check is not yet confirmed', () => {
    const today = yearsAfterCheck(1)
    const [, , check] = freshnessItems('2026-03-09', today)
    expect(check).toEqual({
      text: `${lastEndedTaxYear(today)} HMRC rules not yet confirmed`,
      date: { label: 'last checked', value: checkedOn, href: HMRC_RULES_CHECK_LOG_URL },
    })
  })

  it('links to the check log in the repository', () => {
    expect(HMRC_RULES_CHECK_LOG_URL).toMatch(/\/blob\/main\/docs\/HMRC_RULES_CHECK\.md#checks$/)
  })
})

/** The date n days after the check */
function daysAfterCheck(n: number): string {
  const d = new Date(`${HMRC_RULES_CHECK_DATE}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

describe('hmrcRulesBadge', () => {
  it('names the last ended tax year on the day of the check and up to the age limit', () => {
    const expected = {
      taxYear: lastEndedTaxYear(HMRC_RULES_CHECK_DATE),
      checkedOn,
    }
    expect(hmrcRulesBadge(HMRC_RULES_CHECK_DATE)).toEqual(expected)
    // Unless the limit crosses 6 April, which hides it for another reason
    if (lastEndedTaxYear(daysAfterCheck(HMRC_RULES_BADGE_MAX_AGE_DAYS)) === expected.taxYear) {
      expect(hmrcRulesBadge(daysAfterCheck(HMRC_RULES_BADGE_MAX_AGE_DAYS))).toEqual(expected)
    }
  })

  it('hides once the check is older than the limit', () => {
    expect(hmrcRulesBadge(daysAfterCheck(HMRC_RULES_BADGE_MAX_AGE_DAYS + 1))).toBeNull()
  })

  it('hides when a tax year has ended since the check', () => {
    expect(hmrcRulesBadge(yearsAfterCheck(1))).toBeNull()
  })
})
