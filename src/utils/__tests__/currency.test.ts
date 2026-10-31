import { describe, it, expect } from 'vitest'
import { formatGbp } from '../currency'

describe('formatGbp', () => {
  it('formats positive amounts with thousands separators', () => {
    expect(formatGbp(5897.75)).toBe('£5,897.75')
    expect(formatGbp(3000, 0)).toBe('£3,000')
  })

  it('puts negative amounts in brackets', () => {
    expect(formatGbp(-5897.75)).toBe('(£5,897.75)')
    expect(formatGbp(-6734.912)).toBe('(£6,734.91)')
  })

  it('shows zero, and amounts that round to zero, without brackets', () => {
    expect(formatGbp(0)).toBe('£0.00')
    expect(formatGbp(-0)).toBe('£0.00')
    expect(formatGbp(-0.004)).toBe('£0.00')
  })
})
