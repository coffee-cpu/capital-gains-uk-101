import { HMRC_RULES_CHECK_DATE } from './cgt/hmrcRulesCheck'
import { LAST_BUNDLED_MONTH } from './fx/data/hmrcMonthly'
import { formatIsoDate } from '../utils/date'

/** Where each HMRC rules check is recorded */
export const HMRC_RULES_CHECK_LOG_URL = 'https://github.com/coffee-cpu/capital-gains-uk-101/blob/main/docs/HMRC_RULES_CHECK.md#checks'

export interface FreshnessItem {
  /** Text before the date, or the whole item when there's no date */
  text: string
  date?: string
  /** Where the date links to */
  href?: string
}

/** "2026-12" as "Dec 2026" */
function formatMonth(yearMonth: string): string {
  return formatIsoDate(`${yearMonth}-01`, 'short').replace(/^\d+ /, '')
}

/**
 * How up to date the calculator is, for the footer: when the site was built,
 * the last month of bundled HMRC exchange rates, and the last HMRC rules check of
 * the matching rules and figures (docs/HMRC_RULES_CHECK.md)
 */
export function freshnessItems(buildDate: string): FreshnessItem[] {
  return [
    { text: `Updated ${formatIsoDate(buildDate, 'short')}` },
    { text: `HMRC rates to ${formatMonth(LAST_BUNDLED_MONTH)}` },
    {
      text: 'HMRC rules and allowances checked',
      date: formatIsoDate(HMRC_RULES_CHECK_DATE, 'short'),
      href: HMRC_RULES_CHECK_LOG_URL,
    },
  ]
}
