import { getTaxYear, getTaxYearStart } from '../../utils/taxYear'

/**
 * When the HMRC figures below were last checked against gov.uk and
 * legislation.gov.uk, by hand. Only change it after doing the whole checklist.
 *
 * The tables carry each amount forward until the next entry, as the law does:
 * an amount stays in force until a Finance Act changes it (TCGA 1992 s1K has
 * no annual uprating from 2025/26). So a check confirms every tax year from
 * FIGURES_CHECKED_FROM_TAX_YEAR up to the one it was done in, as the law stood
 * that day. A Budget can still change
 * the current year part-way through (CGT rates did on 30 October 2024), so
 * check again after each Budget and each 6 April.
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

/**
 * The earliest tax year the check covers: the oldest year that all the
 * checked gov.uk tables list (dividend figures start at 2023/24, the annual
 * exempt amount at 2021/22). Older years' figures weren't checked.
 */
export const FIGURES_CHECKED_FROM_TAX_YEAR = '2023/24'

/** The latest tax year the check covers: the one it was done in */
export function figuresCheckedThroughTaxYear(): string {
  return getTaxYear(HMRC_FIGURES_CHECKED)
}

/** Whether the check covered a tax year's figures */
export function areFiguresCheckedFor(taxYear: string): boolean {
  const start = getTaxYearStart(taxYear)
  return start >= getTaxYearStart(FIGURES_CHECKED_FROM_TAX_YEAR) && start <= HMRC_FIGURES_CHECKED
}
