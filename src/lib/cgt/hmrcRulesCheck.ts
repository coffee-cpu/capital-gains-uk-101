import { getTaxYear, getTaxYearEnd, getTaxYearStart } from '../../utils/taxYear'

/**
 * The date of the last HMRC rules check: the matching rules and every HMRC figure
 * the engine uses, checked by hand against gov.uk and legislation.gov.uk.
 * The checklist and each check's results are in docs/HMRC_RULES_CHECK.md; this date
 * must match its latest entry (src/__tests__/docs.test.ts checks). Only change
 * it as part of a check.
 *
 * The tables carry each amount forward until the next entry, as the law does:
 * an amount stays in force until a Finance Act changes it. A Budget can still
 * change the tax year that's under way (CGT rates changed on 30 October 2024),
 * so a check confirms only the tax years that had ended by its date.
 */
export const HMRC_RULES_CHECK_DATE = '2026-11-27'

/** Whether a tax year had ended by the last check, so the check confirms its rules and figures */
export function isConfirmedByHmrcRulesCheck(taxYear: string): boolean {
  return getTaxYearEnd(taxYear) < HMRC_RULES_CHECK_DATE
}

/** The tax year before the one a date falls in: the last one to have ended */
export function lastEndedTaxYear(date: string): string {
  const startYear = parseInt(getTaxYearStart(getTaxYear(date)).slice(0, 4))
  return getTaxYear(`${startYear - 1}-04-06`)
}
