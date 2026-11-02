import { describe, it, expect } from 'vitest'
import { isCryptoasset, sa108Rows } from '../sa108'
import { calculateCGT } from '../engine'
import type { EnrichedTransaction } from '../../../types/transaction'

const tx = (overrides: Partial<EnrichedTransaction>): EnrichedTransaction => ({
  id: 'tx', source: 'Generic CSV', symbol: 'AAA', name: null, date: '2024-06-03', type: 'BUY',
  quantity: 1, price: 100, currency: 'GBP', total: 100, fee: 0, notes: null,
  fx_rate: 1, price_gbp: 100, value_gbp: 100, fee_gbp: 0, fx_source: 'Native GBP', fx_error: null,
  tax_year: '2024/25', ...overrides,
})

describe('isCryptoasset', () => {
  it('follows an explicit asset_class', () => {
    expect(isCryptoasset({ source: 'Generic CSV', currency: 'GBP', asset_class: 'crypto' })).toBe(true)
    expect(isCryptoasset({ source: 'Coinbase', currency: 'BTC', asset_class: 'share' })).toBe(false)
  })

  it('treats crypto exchange exports and cryptocurrency-priced rows as crypto', () => {
    expect(isCryptoasset({ source: 'Coinbase', currency: 'GBP' })).toBe(true)
    expect(isCryptoasset({ source: 'Generic CSV', currency: 'BTC' })).toBe(true)
  })

  it('does not guess from the symbol', () => {
    // ETH is also a listed share ticker (Ethan Allen)
    expect(isCryptoasset({ source: 'Generic CSV', currency: 'USD' })).toBe(false)
  })
})

describe('sa108Rows - Generic CSV crypto', () => {
  it('reports a Generic CSV row marked crypto in the Cryptoassets section', () => {
    const result = calculateCGT([
      tx({ id: 'btc-buy', symbol: 'BTC', date: '2024-05-01', asset_class: 'crypto' }),
      tx({ id: 'btc-sell', symbol: 'BTC', type: 'SELL', price: 150, price_gbp: 150, asset_class: 'crypto' }),
      tx({ id: 'aaa-buy', date: '2024-05-01' }),
      tx({ id: 'aaa-sell', type: 'SELL', price: 120, price_gbp: 120 }),
    ])

    const rows = sa108Rows('2024/25', result.disposals)

    expect(rows.map(r => [r.category, r.gainsGbp])).toEqual([
      ['LISTED_SHARES', 20],
      ['CRYPTO', 50],
    ])
  })
})
