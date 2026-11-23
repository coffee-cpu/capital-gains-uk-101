import { describe, it, expect } from 'vitest'
import { parseISODate } from '../parsingUtils'

describe('parseISODate', () => {
  it('takes the date part of ISO dates and timestamps', () => {
    expect(parseISODate('2024-06-10')).toBe('2024-06-10')
    expect(parseISODate('2024-06-10T09:15:42.123456Z')).toBe('2024-06-10')
    expect(parseISODate('2024-06-10 09:15:42')).toBe('2024-06-10')
    expect(parseISODate('2024-06-10 09:15:42 UTC')).toBe('2024-06-10')
    expect(parseISODate(' 2024-06-10 ')).toBe('2024-06-10')
  })

  it('accepts 29 February in a leap year', () => {
    expect(parseISODate('2024-02-29')).toBe('2024-02-29')
  })

  it('rejects dates that are not on the calendar', () => {
    expect(parseISODate('2023-02-29')).toBeNull()
    expect(parseISODate('2024-02-30')).toBeNull()
    expect(parseISODate('2024-13-01')).toBeNull()
    expect(parseISODate('2024-00-10')).toBeNull()
    expect(parseISODate('2024-06-31')).toBeNull()
  })

  it('rejects empty and non-ISO values', () => {
    expect(parseISODate('')).toBeNull()
    expect(parseISODate(null)).toBeNull()
    expect(parseISODate(undefined)).toBeNull()
    expect(parseISODate('10/06/2024')).toBeNull()
    expect(parseISODate('not a date')).toBeNull()
  })
})
