import { describe, it, expect } from 'vitest'
import { parseRatioMultiplier } from '../transaction'

describe('parseRatioMultiplier', () => {
  it('should parse 2:1 split ratio correctly', () => {
    expect(parseRatioMultiplier('2:1')).toBe(2.0)
  })

  it('should parse 10:1 split ratio correctly', () => {
    expect(parseRatioMultiplier('10:1')).toBe(10.0)
  })

  it('should parse 4:1 split ratio correctly', () => {
    expect(parseRatioMultiplier('4:1')).toBe(4.0)
  })

  it('should parse 20:1 split ratio correctly', () => {
    expect(parseRatioMultiplier('20:1')).toBe(20.0)
  })

  it('should parse 1:10 reverse split ratio correctly', () => {
    expect(parseRatioMultiplier('1:10')).toBe(0.1)
  })

  it('should parse 1:5 reverse split ratio correctly', () => {
    expect(parseRatioMultiplier('1:5')).toBe(0.2)
  })

  it('should parse 3:2 fractional split ratio correctly', () => {
    expect(parseRatioMultiplier('3:2')).toBe(1.5)
  })

  it('should parse 5:4 fractional split ratio correctly', () => {
    expect(parseRatioMultiplier('5:4')).toBe(1.25)
  })

  it('should throw error for invalid format (missing colon)', () => {
    expect(() => parseRatioMultiplier('10')).toThrow('Invalid split ratio format')
  })

  it('should throw error for invalid format (too many colons)', () => {
    expect(() => parseRatioMultiplier('10:1:2')).toThrow('Invalid split ratio format')
  })

  it('should throw error for non-numeric values', () => {
    expect(() => parseRatioMultiplier('abc:def')).toThrow('Invalid split ratio values')
  })

  it('should throw error for zero denominator', () => {
    expect(() => parseRatioMultiplier('10:0')).toThrow('Invalid split ratio values')
  })

  it('should throw error for empty string', () => {
    expect(() => parseRatioMultiplier('')).toThrow('Invalid split ratio format')
  })
})
