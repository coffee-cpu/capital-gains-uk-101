import { describe, it, expect } from 'vitest'
import { matchSymbolsByIsin } from '../symbolMatching'
import type { GenericTransaction } from '../../types/transaction'

const tx = (
  id: string, symbol: string, isin: string | null, source = 'Test', date = '2024-06-03',
  type: GenericTransaction['type'] = 'BUY'
): GenericTransaction => ({
  id, source, symbol, isin, name: null, date, type,
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
    // The US ADR and the London listing traded over overlapping periods
    const { transactions, conflicts, merges } = matchSymbolsByIsin([
      tx('us-1', 'BP', 'US0556221044', 'Test', '2023-01-10'),
      tx('uk-1', 'BP', 'GB0007980591', 'Test', '2023-03-01'),
      tx('us-2', 'BP', 'US0556221044', 'Test', '2024-06-01'),
      tx('unknown', 'BP', null),
    ])

    expect(transactions.map(t => t.symbol)).toEqual(['BP (US0556221044)', 'BP (GB0007980591)', 'BP (US0556221044)', 'BP'])
    expect(conflicts).toEqual([{ symbol: 'BP', isins: ['US0556221044', 'GB0007980591'], pooledSeparately: true }])
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

  it('treats old-out and new-in rows on the same day as an ISIN change, listed old to new', () => {
    const { transactions, conflicts } = matchSymbolsByIsin([
      tx('buy', 'ABC', 'GB00B00000Z9', 'Test', '2022-01-10'),
      tx('out', 'ABC', 'GB00B00000Z9', 'Test', '2023-05-01'),
      tx('in', 'ABC', 'GB00A00000Z1', 'Test', '2023-05-01'),
      tx('sell', 'ABC', 'GB00A00000Z1', 'Test', '2024-02-01'),
    ])

    expect(new Set(transactions.map(t => t.symbol))).toEqual(new Set(['ABC']))
    // The new ISIN sorts first alphabetically; the list follows first use instead
    expect(conflicts).toEqual([{ symbol: 'ABC', isins: ['GB00B00000Z9', 'GB00A00000Z1'], pooledSeparately: false }])
  })

  it('ignores a dividend paid under the old ISIN after the change when dating ISINs', () => {
    const { transactions, conflicts } = matchSymbolsByIsin([
      tx('buy', 'SHEL', 'GB00B03MLX29', 'Freetrade', '2022-01-10'),
      tx('swap-in', 'SHEL', 'GB00BP6MXD84', 'Freetrade', '2022-01-31', 'TRANSFER'),
      tx('late-dividend', 'SHEL', 'GB00B03MLX29', 'Freetrade', '2022-03-28', 'DIVIDEND'),
      tx('sell', 'SHEL', 'GB00BP6MXD84', 'Freetrade', '2024-02-01', 'SELL'),
    ])

    expect(new Set(transactions.map(t => t.symbol))).toEqual(new Set(['SHEL']))
    expect(conflicts[0].pooledSeparately).toBe(false)
  })

  it('returns the input unchanged when nothing needs matching', () => {
    const input = [tx('a', 'AAPL', 'US0378331005'), tx('b', 'AAPL', null), tx('c', 'MSFT', null)]
    const result = matchSymbolsByIsin(input)
    expect(result.transactions).toBe(input)
    expect(result.merges).toEqual([])
    expect(result.conflicts).toEqual([])
  })
})
