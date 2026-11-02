import { describe, it, expect } from 'vitest'
import { matchSymbolsByIsin } from '../symbolMatching'
import type { GenericTransaction } from '../../types/transaction'

const tx = (id: string, symbol: string, isin: string | null, source = 'Test'): GenericTransaction => ({
  id, source, symbol, isin, name: null, date: '2024-06-03', type: 'BUY',
  quantity: 1, price: 100, currency: 'GBP', total: 100, fee: 0, notes: null,
})

const VUSA_ISIN = 'IE00B3XXRP09'

describe('matchSymbolsByIsin', () => {
  it('gives tickers with the same ISIN one symbol, the most used one', () => {
    const { transactions, merges } = matchSymbolsByIsin([
      tx('t212-1', 'VUSA', VUSA_ISIN, 'Trading 212'),
      tx('ft-1', 'VUSAL', VUSA_ISIN, 'Freetrade'),
      tx('ib-1', 'VUSA', null, 'Interactive Brokers'),
    ])

    expect(transactions.map(t => t.symbol)).toEqual(['VUSA', 'VUSA', 'VUSA'])
    expect(merges).toEqual([{ isin: VUSA_ISIN, symbol: 'VUSA', mergedSymbols: ['VUSAL'] }])
  })

  it('renames rows of a merged ticker that have no ISIN too', () => {
    const { transactions } = matchSymbolsByIsin([
      tx('a', 'VUSA', VUSA_ISIN), tx('b', 'VUSA', null),
      tx('c', 'VUSAL', VUSA_ISIN), tx('d', 'VUSAL', null),
    ])
    // Tie on row count: the shorter ticker wins
    expect(new Set(transactions.map(t => t.symbol))).toEqual(new Set(['VUSA']))
  })

  it('keeps a ticker that names two securities apart by ISIN', () => {
    const { transactions, conflicts, merges } = matchSymbolsByIsin([
      tx('us', 'BP', 'US0556221044'),
      tx('uk', 'BP', 'GB0007980591'),
      tx('unknown', 'BP', null),
    ])

    expect(transactions.map(t => t.symbol)).toEqual(['BP (US0556221044)', 'BP (GB0007980591)', 'BP'])
    expect(conflicts).toEqual([{ symbol: 'BP', isins: ['GB0007980591', 'US0556221044'] }])
    expect(merges).toEqual([])
  })

  it('returns the input unchanged when nothing needs matching', () => {
    const input = [tx('a', 'AAPL', 'US0378331005'), tx('b', 'AAPL', null), tx('c', 'MSFT', null)]
    const result = matchSymbolsByIsin(input)
    expect(result.transactions).toBe(input)
    expect(result.merges).toEqual([])
    expect(result.conflicts).toEqual([])
  })
})
