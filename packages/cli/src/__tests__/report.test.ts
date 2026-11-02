// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildCalculateReport } from '../report'
import { calculateCGT } from '../../../../src/lib/cgt/engine'
import type { EnrichedTransaction } from '../../../../src/types/transaction'

const tx = (overrides: Partial<EnrichedTransaction>): EnrichedTransaction => ({
  id: 'tx', source: 'Generic CSV', symbol: 'AAA', name: null, date: '2024-06-03', type: 'BUY',
  quantity: 10, price: 100, currency: 'GBP', total: 1000, fee: 0, notes: null,
  fx_rate: 1, price_gbp: 100, value_gbp: 1000, fee_gbp: 0, fx_source: 'Native GBP', fx_error: null,
  tax_year: '2024/25',
  ...overrides,
})

const OPTIONS = {
  taxYear: '2024/25', fxSource: 'HMRC_MONTHLY' as const, autoSplits: false, offline: true,
  details: false, inputs: [], warnings: [],
}

describe('buildCalculateReport - SA108 figures', () => {
  const result = calculateCGT([
    // Listed shares: bought, then sold in two parts on the same day (one disposal for SA108)
    tx({ id: 'aaa-buy', date: '2024-05-01', quantity: 20, total: 2000 }),
    tx({ id: 'aaa-sell-1', type: 'SELL', quantity: 5, price: 120, price_gbp: 120, total: 600, fee: 6, fee_gbp: 6 }),
    tx({ id: 'aaa-sell-2', type: 'SELL', quantity: 5, price: 120, price_gbp: 120, total: 600 }),
    // Cryptoasset from Coinbase: a loss
    tx({ id: 'btc-buy', source: 'Coinbase', symbol: 'BTC', date: '2024-05-01', quantity: 1, price: 1000, price_gbp: 1000 }),
    tx({ id: 'btc-sell', source: 'Coinbase', symbol: 'BTC', type: 'SELL', quantity: 1, price: 500, price_gbp: 500 }),
  ])
  const year = buildCalculateReport(result, OPTIONS).taxYears[0]

  it('reports only listed shares in sa108, counting same-day sales once with gross proceeds', () => {
    expect(year.sa108).toEqual({
      numberOfDisposals: 1,
      disposalProceedsGbp: 1200,
      allowableCostsGbp: 1006, // 10 shares at 100, plus the 6 selling fee
      gainsBeforeLossesGbp: 194,
      lossesGbp: 0,
    })
  })

  it('lists every section, with crypto separate from listed shares', () => {
    expect(year.sa108Sections.map(s => [s.category, s.section, s.numberOfDisposals, s.lossesGbp])).toEqual([
      ['listed-shares', 'Listed shares and securities', 1, 0],
      ['crypto', 'Cryptoassets', 1, 500],
    ])
    expect(year.sa108Sections[0].boxes?.proceeds).toBe('24')
  })

  it('totals the whole year with the same disposal count rule', () => {
    expect(year.disposals).toBe(2)
    expect(year.gainsGbp).toBe(194)
    expect(year.lossesGbp).toBe(500)
  })
})
