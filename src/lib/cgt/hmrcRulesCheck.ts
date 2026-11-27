import { getTaxYear, getTaxYearStart } from '../../utils/taxYear'

/**
 * The date of the last HMRC rules check: the matching rules and every HMRC figure
 * the engine uses, checked by hand against gov.uk and legislation.gov.uk.
 * The checklist and each check's results are in docs/HMRC_RULES_CHECK.md; this date
 * must match its latest entry (src/__tests__/docs.test.ts checks). Only change
 * it as part of a check.
 *
 * The tables carry each amount forward until the next entry, as the law does:
 * an amount stays in force until a Finance Act changes it. The check guards
 * against the app falling behind a change, which can only affect the year it
 * was done in and later ones: past years are fixed. A tax year that starts
 * after the check hasn't been looked at yet.
 */
export const HMRC_RULES_CHECK_DATE = '2026-11-27'

/** The tax year the last check was done in */
export function hmrcRulesCheckTaxYear(): string {
  return getTaxYear(HMRC_RULES_CHECK_DATE)
}

/** Whether a tax year starts after the last check, so it hasn't been checked yet */
export function isAfterHmrcRulesCheck(taxYear: string): boolean {
  return getTaxYearStart(taxYear) > HMRC_RULES_CHECK_DATE
}
