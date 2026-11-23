import { describe, it, expect } from 'vitest'
import { normalizeSymbol } from '../symbolNormalization'

describe('Symbol Normalization', () => {
  it('should normalize FB to META', () => {
    expect(normalizeSymbol('FB')).toBe('META')
  })

  it('should keep META as META', () => {
    expect(normalizeSymbol('META')).toBe('META')
  })

  it('should keep symbols that have no renames unchanged', () => {
    expect(normalizeSymbol('AAPL')).toBe('AAPL')
    expect(normalizeSymbol('GOOGL')).toBe('GOOGL')
    expect(normalizeSymbol('MSFT')).toBe('MSFT')
  })

  it('should return null for null input', () => {
    expect(normalizeSymbol(null)).toBe(null)
  })

  it('should return empty string as-is', () => {
    expect(normalizeSymbol('')).toBe('')
  })

  it('should normalize case-sensitive symbols correctly', () => {
    // Symbol tickers are case-sensitive
    expect(normalizeSymbol('fb')).toBe('fb') // lowercase fb is not in the rename list
    expect(normalizeSymbol('FB')).toBe('META') // uppercase FB is
  })
})
