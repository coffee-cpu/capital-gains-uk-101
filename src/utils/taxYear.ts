/**
 * UK tax year utilities
 * Tax years run from 6 April to 5 April
 */

/**
 * Get the tax year for a given date
 * @param date Date in YYYY-MM-DD format or Date object
 * @returns Tax year string in format "YYYY/YY" (e.g. "2023/24")
 */
export function getTaxYear(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = d.getMonth() + 1 // 0-indexed
  const day = d.getDate()

  // Tax year starts on 6 April
  // If date is before 6 April, it belongs to previous tax year
  if (month < 4 || (month === 4 && day < 6)) {
    const startYear = year - 1
    const endYear = year.toString().slice(-2)
    return `${startYear}/${endYear}`
  }

  const endYear = (year + 1).toString().slice(-2)
  return `${year}/${endYear}`
}

/**
 * Get the start date of a tax year
 * @param taxYear Tax year string (e.g. "2023/24")
 * @returns ISO date string (YYYY-MM-DD)
 */
export function getTaxYearStart(taxYear: string): string {
  const startYear = parseInt(taxYear.split('/')[0])
  return `${startYear}-04-06`
}

/**
 * Get the end date of a tax year
 * @param taxYear Tax year string (e.g. "2023/24")
 * @returns ISO date string (YYYY-MM-DD)
 */
export function getTaxYearEnd(taxYear: string): string {
  const startYear = parseInt(taxYear.split('/')[0])
  return `${startYear + 1}-04-05`
}
