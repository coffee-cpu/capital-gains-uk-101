/**
 * How an ISO date is written:
 * - `chart`: 15 Jan 24
 * - `short`: 6 Apr 2024
 * - `long`: 19 November 2026
 * - `numeric`: 06/04/2024
 */
export type IsoDateStyle = 'chart' | 'short' | 'long' | 'numeric'

const FORMATS: Record<IsoDateStyle, Intl.DateTimeFormat> = {
  chart: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' }),
  short: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
  long: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  numeric: new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC' }),
}

/**
 * Format an ISO date (YYYY-MM-DD, or the date part of a timestamp) as a UK date.
 *
 * The date is read as UTC midnight and written in UTC, so it is the same day
 * on every machine: formatting in local time prints the day before west of UTC.
 */
export function formatIsoDate(iso: string, style: IsoDateStyle): string {
  return FORMATS[style].format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))
}
