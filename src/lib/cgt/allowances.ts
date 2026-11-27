/**
 * Tax-free allowances by tax year.
 *
 * Each table maps the first year of a tax year (2024 = 2024/25) to the
 * amount that applies from that year until the next entry. Years after the
 * last entry use the latest amount, as the law does until a Finance Act
 * changes it. docs/HMRC_RULES_CHECK.md records when these were last checked.
 */

/**
 * Capital Gains Tax annual exempt amount (individuals).
 *
 * Source: https://www.gov.uk/government/publications/rates-and-allowances-capital-gains-tax/capital-gains-tax-rates-and-annual-tax-free-allowances
 */
const ANNUAL_EXEMPT_AMOUNTS: ReadonlyArray<readonly [number, number]> = [
  [2014, 11000],
  [2015, 11100],
  [2017, 11300],
  [2018, 11700],
  [2019, 12000],
  [2020, 12300],
  [2023, 6000],
  [2024, 3000],
]

/**
 * Dividend allowance. None before 2016/17.
 *
 * Source: https://www.gov.uk/tax-on-dividends
 */
const DIVIDEND_ALLOWANCES: ReadonlyArray<readonly [number, number]> = [
  [2016, 5000],
  [2018, 2000],
  [2023, 1000],
  [2024, 500],
]

function lookup(
  table: ReadonlyArray<readonly [number, number]>,
  taxYear: string,
  beforeFirst: number
): number {
  // Tax year format: "YYYY/YY" e.g., "2023/24"
  const startYear = parseInt(taxYear.split('/')[0])
  let amount = beforeFirst
  for (const [fromYear, value] of table) {
    if (startYear < fromYear) break
    amount = value
  }
  return amount
}

/** Percentages for the basic, higher and additional rate bands */
export interface IncomeTaxRates {
  basic: number
  higher: number
  additional: number
}

export type DividendTaxRates = IncomeTaxRates

/**
 * Dividend tax rates, from 2016/17 when the dividend allowance began.
 *
 * Source: https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past
 */
const DIVIDEND_TAX_RATES: ReadonlyArray<readonly [number, IncomeTaxRates]> = [
  [2016, { basic: 7.5, higher: 32.5, additional: 38.1 }],
  [2022, { basic: 8.75, higher: 33.75, additional: 39.35 }],
  [2026, { basic: 10.75, higher: 35.75, additional: 39.35 }],
]

/**
 * Savings rates of income tax (on interest above the Personal Savings
 * Allowance), from 2016/17 when the allowance began.
 *
 * 2027/28: Finance Act 2026 s5. Budget 2026 proposes 24% / 44% / 49% instead,
 * to be legislated in Finance Bill 2026-27; until it's enacted the law is
 * 22% / 42% / 47%. docs/HMRC_RULES_CHECK.md tracks it.
 *
 * Sources: https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past,
 * https://www.legislation.gov.uk/ukpga/2026/11/section/5/enacted
 */
const SAVINGS_TAX_RATES: ReadonlyArray<readonly [number, IncomeTaxRates]> = [
  [2016, { basic: 20, higher: 40, additional: 45 }],
  [2027, { basic: 22, higher: 42, additional: 47 }],
]

function lookupRates(table: ReadonlyArray<readonly [number, IncomeTaxRates]>, taxYear: string): IncomeTaxRates | null {
  const startYear = parseInt(taxYear.split('/')[0])
  let rates: IncomeTaxRates | null = null
  for (const [fromYear, value] of table) {
    if (startYear < fromYear) break
    rates = value
  }
  return rates
}

/** Each period with the same rates, oldest first; toYear is null for the latest */
function ratePeriods(
  table: ReadonlyArray<readonly [number, IncomeTaxRates]>
): { fromYear: number; toYear: number | null; rates: IncomeTaxRates }[] {
  return table.map(([fromYear, rates], i) => ({
    fromYear,
    toYear: i + 1 < table.length ? table[i + 1][0] - 1 : null,
    rates,
  }))
}

/** Dividend tax rates for a tax year, or null before 2016/17 */
export function getDividendTaxRates(taxYear: string): DividendTaxRates | null {
  return lookupRates(DIVIDEND_TAX_RATES, taxYear)
}

/** Each period with the same dividend tax rates, oldest first; toYear is null for the latest */
export function dividendTaxRatePeriods(): { fromYear: number; toYear: number | null; rates: DividendTaxRates }[] {
  return ratePeriods(DIVIDEND_TAX_RATES)
}

/** Savings rates of income tax for a tax year, or null before 2016/17 */
export function getSavingsTaxRates(taxYear: string): IncomeTaxRates | null {
  return lookupRates(SAVINGS_TAX_RATES, taxYear)
}

/** Each period with the same savings rates, oldest first; toYear is null for the latest */
export function savingsTaxRatePeriods(): { fromYear: number; toYear: number | null; rates: IncomeTaxRates }[] {
  return ratePeriods(SAVINGS_TAX_RATES)
}

/**
 * CGT annual exempt amount for a tax year. Years before 2014/15 use the
 * 2014/15 amount as an approximation.
 */
export function getAnnualExemptAmount(taxYear: string): number {
  return lookup(ANNUAL_EXEMPT_AMOUNTS, taxYear, ANNUAL_EXEMPT_AMOUNTS[0][1])
}

/**
 * Dividend allowance for a tax year (0 before 2016/17).
 *
 * Dividend tax is separate from capital gains tax. The app doesn't
 * calculate it; the rates by tax year are listed in the help text.
 */
export function getDividendAllowance(taxYear: string): number {
  return lookup(DIVIDEND_ALLOWANCES, taxYear, 0)
}
