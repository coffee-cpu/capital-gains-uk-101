/**
 * Tax-free allowances by tax year.
 *
 * Each table maps the first year of a tax year (2024 = 2024/25) to the
 * amount that applies from that year until the next entry. Years after the
 * last entry use the latest amount, as the law does until a Finance Act
 * changes it. docs/HMRC_AUDIT.md records when these were last checked.
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

export interface DividendTaxRates {
  /** Percentages for dividends in the basic, higher and additional rate bands */
  basic: number
  higher: number
  additional: number
}

/**
 * Dividend tax rates, from 2016/17 when the dividend allowance began.
 *
 * Source: https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past
 */
const DIVIDEND_TAX_RATES: ReadonlyArray<readonly [number, DividendTaxRates]> = [
  [2016, { basic: 7.5, higher: 32.5, additional: 38.1 }],
  [2022, { basic: 8.75, higher: 33.75, additional: 39.35 }],
  [2026, { basic: 10.75, higher: 35.75, additional: 39.35 }],
]

/** Dividend tax rates for a tax year, or null before 2016/17 */
export function getDividendTaxRates(taxYear: string): DividendTaxRates | null {
  const startYear = parseInt(taxYear.split('/')[0])
  let rates: DividendTaxRates | null = null
  for (const [fromYear, value] of DIVIDEND_TAX_RATES) {
    if (startYear < fromYear) break
    rates = value
  }
  return rates
}

/** Each period with the same dividend tax rates, oldest first; toYear is null for the latest */
export function dividendTaxRatePeriods(): { fromYear: number; toYear: number | null; rates: DividendTaxRates }[] {
  return DIVIDEND_TAX_RATES.map(([fromYear, rates], i) => ({
    fromYear,
    toYear: i + 1 < DIVIDEND_TAX_RATES.length ? DIVIDEND_TAX_RATES[i + 1][0] - 1 : null,
    rates,
  }))
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
