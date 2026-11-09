import { describe, it, expect } from 'vitest'
import { formatGbp, formatGbpWhole } from '../currency'
import { formatQuantity } from '../quantity'

describe('formatGbp', () => {
  it('formats positive amounts with thousands separators', () => {
    expect(formatGbp(5897.75)).toBe('£5,897.75')
    expect(formatGbp(47302)).toBe('£47,302.00')
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

describe('formatGbpWhole', () => {
  it('rounds to whole pounds with a minus sign for negatives', () => {
    expect(formatGbpWhole(1234)).toBe('£1,234')
    expect(formatGbpWhole(1234.56)).toBe('£1,235')
    expect(formatGbpWhole(-5000)).toBe('-£5,000')
    expect(formatGbpWhole(0)).toBe('£0')
  })
})

describe('formatQuantity', () => {
  it('shows at least two decimals, without thousands separators', () => {
    expect(formatQuantity(500)).toBe('500.00')
    expect(formatQuantity(3500)).toBe('3500.00')
    expect(formatQuantity(1.5)).toBe('1.50')
  })

  it('keeps small fractional quantities visible', () => {
    expect(formatQuantity(0.00012345)).toBe('0.00012345')
    expect(formatQuantity(0.123456789)).toBe('0.12345679')
  })
})
