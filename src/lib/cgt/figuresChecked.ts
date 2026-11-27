import { getTaxYear, getTaxYearStart } from '../../utils/taxYear'

/**
 * When the HMRC figures below were last checked against gov.uk and
 * legislation.gov.uk, by hand. Only change it after doing the whole checklist.
 *
 * The tables carry each amount forward until the next entry, as the law does:
 * an amount stays in force until a Finance Act changes it (TCGA 1992 s1K has
 * no annual uprating from 2025/26). The check guards against the app falling
 * behind a change, which can only affect the year it was done in and later
 * ones: past years' figures are fixed. A tax year that starts after the check
 * hasn't been looked at yet. A Budget can still change the current year
 * part-way through (CGT rates did on 30 October 2024), so check again after
 * each Budget and each 6 April.
 *
 * Checklist (where in the code: what to compare, and where):
 * - allowances.ts ANNUAL_EXEMPT_AMOUNTS: CGT annual exempt amount by year
 *   https://www.gov.uk/government/publications/rates-and-allowances-capital-gains-tax/capital-gains-tax-rates-and-annual-tax-free-allowances
 *   https://www.legislation.gov.uk/ukpga/1992/12/section/1K
 * - taxYearFeatures/cgtRateChange2024.ts: CGT rates for shares (10%/20% to
 *   18%/24% from 30 October 2024) and that no later change applies (same page)
 * - reporting.ts: SA108 limits, £50,000 proceeds or gains over the annual
 *   exempt amount, in the latest SA108 notes (CGN 1)
 *   https://www.gov.uk/government/publications/self-assessment-capital-gains-summary-sa108
 * - reporting.ts SA100_FOREIGN_DIVIDENDS_LIMITS: box 6 "Foreign dividends (up
 *   to £X)" on the latest SA100; add the new return's year when it's published
 *   https://www.gov.uk/government/publications/self-assessment-tax-return-sa100
 * - allowances.ts DIVIDEND_ALLOWANCES and DIVIDEND_TAX_RATES
 *   https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past
 * - Dividend reporting (£10,000 Self Assessment threshold) in
 *   IncomeDetailsPanels.tsx and the help text
 *   https://www.gov.uk/tax-on-dividends/how-to-report-tax-on-dividends
 * - Personal Savings Allowance (£1,000 / £500 / £0) and savings rates
 *   (20% / 40% / 45%) in IncomeDetailsPanels.tsx and the help text
 *   https://www.gov.uk/apply-tax-free-interest-on-savings/how-much-is-tax-free
 *
 * HMRC exchange rates are not part of this check: a weekly workflow keeps the
 * bundled rates up to date (see scripts/vendor-hmrc-rates.mjs).
 */
export const HMRC_FIGURES_CHECKED = '2026-11-27'

/** The tax year the check was done in */
export function figuresCheckedTaxYear(): string {
  return getTaxYear(HMRC_FIGURES_CHECKED)
}

/** Whether a tax year starts after the check, so its figures haven't been checked yet */
export function isAfterFiguresCheck(taxYear: string): boolean {
  return getTaxYearStart(taxYear) > HMRC_FIGURES_CHECKED
}
