/**
 * Tax-free allowances by tax year.
 *
 * Each table maps the first year of a tax year (2024 = 2024/25) to the
 * amount that applies from that year until the next entry. Years after the
 * last entry use the latest amount.
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
