import { HMRC_RULES_CHECK_DATE, isConfirmedByHmrcRulesCheck, lastEndedTaxYear } from './cgt/hmrcRulesCheck'
import { LAST_BUNDLED_MONTH } from './fx/data/hmrcMonthly'
import { formatIsoDate } from '../utils/date'

/** Where each HMRC rules check is recorded */
export const HMRC_RULES_CHECK_LOG_URL = 'https://github.com/coffee-cpu/capital-gains-uk-101/blob/main/docs/HMRC_RULES_CHECK.md#checks'

export interface FreshnessItem {
  text: string
  /** A date in brackets after the text, e.g. "(checked 27 Nov 2026)", linking to href */
  date?: { label: string; value: string; href: string }
}

/** "2026-12" as "Dec 2026" */
function formatMonth(yearMonth: string): string {
  return formatIsoDate(`${yearMonth}-01`, 'short').replace(/^\d+ /, '')
}

/**
 * How up to date the calculator is, for the footer: when the site was built,
 * the last month of bundled HMRC exchange rates, and whether the last HMRC rules
 * check (docs/HMRC_RULES_CHECK.md) confirms the last tax year to have ended by
 * today, the one people are usually filing for
 */
export function freshnessItems(buildDate: string, today: string): FreshnessItem[] {
  const filingYear = lastEndedTaxYear(today)
  const confirmed = isConfirmedByHmrcRulesCheck(filingYear)
  return [
    { text: `Updated ${formatIsoDate(buildDate, 'short')}` },
    { text: `HMRC rates to ${formatMonth(LAST_BUNDLED_MONTH)}` },
    {
      text: confirmed ? `Up to date with HMRC rules for ${filingYear}` : `${filingYear} HMRC rules not yet confirmed`,
      date: {
        label: confirmed ? 'checked' : 'last checked',
        value: formatIsoDate(HMRC_RULES_CHECK_DATE, 'short'),
        href: HMRC_RULES_CHECK_LOG_URL,
      },
    },
  ]
}

/** How many days after a check the "up to date" badge still shows. The check runs monthly; this leaves about two weeks to review and merge its PR */
export const HMRC_RULES_BADGE_MAX_AGE_DAYS = 45

export interface HmrcRulesBadge {
  /** The last tax year to have ended, which the check confirms */
  taxYear: string
  checkedOn: string
  href: string
}

/**
 * The "HMRC rules 2025/26" badge in the header, or null
 * when it shouldn't show: the last check doesn't confirm the last ended tax
 * year (from 6 April until the next check), or it's more than
 * HMRC_RULES_BADGE_MAX_AGE_DAYS old. The footer still shows the details then
 */
export function hmrcRulesBadge(today: string): HmrcRulesBadge | null {
  const taxYear = lastEndedTaxYear(today)
  const ageDays = (Date.parse(today) - Date.parse(HMRC_RULES_CHECK_DATE)) / 86_400_000
  if (!isConfirmedByHmrcRulesCheck(taxYear) || ageDays > HMRC_RULES_BADGE_MAX_AGE_DAYS) return null
  return { taxYear, checkedOn: formatIsoDate(HMRC_RULES_CHECK_DATE, 'short'), href: HMRC_RULES_CHECK_LOG_URL }
}
