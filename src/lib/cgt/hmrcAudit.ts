import { getTaxYear, getTaxYearStart } from '../../utils/taxYear'

/**
 * The date of the last HMRC audit: the matching rules and every HMRC figure
 * the engine uses, checked by hand against gov.uk and legislation.gov.uk.
 * The checklist and each audit's results are in docs/HMRC_AUDIT.md; this date
 * must match its latest entry (src/__tests__/docs.test.ts checks). Only change
 * it as part of an audit.
 *
 * The tables carry each amount forward until the next entry, as the law does:
 * an amount stays in force until a Finance Act changes it. The audit guards
 * against the app falling behind a change, which can only affect the year it
 * was done in and later ones: past years are fixed. A tax year that starts
 * after the audit hasn't been looked at yet.
 */
export const HMRC_AUDIT_DATE = '2026-11-27'

/** The tax year the last audit was done in */
export function hmrcAuditTaxYear(): string {
  return getTaxYear(HMRC_AUDIT_DATE)
}

/** Whether a tax year starts after the last audit, so it hasn't been checked yet */
export function isAfterHmrcAudit(taxYear: string): boolean {
  return getTaxYearStart(taxYear) > HMRC_AUDIT_DATE
}
