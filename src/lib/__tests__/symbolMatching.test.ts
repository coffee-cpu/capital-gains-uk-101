import { describe, it, expect } from 'vitest'
import { matchSymbolsByIsin } from '../symbolMatching'
import type { GenericTransaction } from '../../types/transaction'

const tx = (id: string, symbol: string, isin: string | null, source = 'Test', date = '2024-06-03'): GenericTransaction => ({
  id, source, symbol, isin, name: null, date, type: 'BUY',
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
    expect(conflicts).toEqual([{ symbol: 'BP', isins: ['GB0007980591', 'US0556221044'], pooledSeparately: true }])
    expect(merges).toEqual([])
  })

  it('keeps one pool when a ticker\'s ISIN changed over time (S127 reorganisation)', () => {
    // Shell's 2022 unification: GB00B03MLX29 became GB00BP6MXD84, same ticker
    const { transactions, conflicts } = matchSymbolsByIsin([
      tx('buy', 'SHEL', 'GB00B03MLX29', 'Freetrade', '2021-05-10'),
      tx('buy-2', 'SHEL', 'GB00B03MLX29', 'Freetrade', '2021-11-02'),
      tx('sell', 'SHEL', 'GB00BP6MXD84', 'Freetrade', '2023-03-15'),
    ])

    expect(transactions.map(t => t.symbol)).toEqual(['SHEL', 'SHEL', 'SHEL'])
    expect(conflicts).toEqual([{ symbol: 'SHEL', isins: ['GB00B03MLX29', 'GB00BP6MXD84'], pooledSeparately: false }])
  })

  it('keeps a ticker that changed ISIN as the name when another broker\'s ticker shares one of its ISINs', () => {
    const { transactions, merges } = matchSymbolsByIsin([
      tx('a', 'SHEL', 'GB00B03MLX29', 'Freetrade', '2021-05-10'),
      tx('b', 'SHEL', 'GB00BP6MXD84', 'Freetrade', '2023-03-15'),
      tx('c', 'RDSB', 'GB00B03MLX29', 'Other', '2021-06-01'),
      tx('d', 'RDSB', 'GB00B03MLX29', 'Other', '2021-07-01'),
      tx('e', 'RDSB', 'GB00B03MLX29', 'Other', '2021-08-01'),
    ])

    expect(new Set(transactions.map(t => t.symbol))).toEqual(new Set(['SHEL']))
    expect(merges).toEqual([{ isin: 'GB00B03MLX29', symbol: 'SHEL', mergedSymbols: ['RDSB'] }])
  })

  it('returns the input unchanged when nothing needs matching', () => {
    const input = [tx('a', 'AAPL', 'US0378331005'), tx('b', 'AAPL', null), tx('c', 'MSFT', null)]
    const result = matchSymbolsByIsin(input)
    expect(result.transactions).toBe(input)
    expect(result.merges).toEqual([])
    expect(result.conflicts).toEqual([])
  })
})
