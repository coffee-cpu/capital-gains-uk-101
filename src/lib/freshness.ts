import { HMRC_FIGURES_CHECKED } from './cgt/figuresChecked'
import { LAST_BUNDLED_MONTH } from './fx/data/hmrcMonthly'
import { formatIsoDate } from '../utils/date'

/** "2026-12" as "Dec 2026" */
function formatMonth(yearMonth: string): string {
  return formatIsoDate(`${yearMonth}-01`, 'short').replace(/^\d+ /, '')
}

/**
 * How up to date the calculator is, for the footer: when the site was built,
 * the last month of bundled HMRC exchange rates, and when the HMRC figures
 * (allowances, rates, reporting limits) were last checked by hand
 */
export function freshnessItems(buildDate: string): string[] {
  return [
    `Updated ${formatIsoDate(buildDate, 'short')}`,
    `HMRC rates to ${formatMonth(LAST_BUNDLED_MONTH)}`,
    `Figures checked ${formatIsoDate(HMRC_FIGURES_CHECKED, 'short')}`,
  ]
}
