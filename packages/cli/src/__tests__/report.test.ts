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

describe('2024/25 rate change in the report', () => {
  const result = calculateCGT([
    tx({ id: 'buy', date: '2024-05-01', quantity: 100, total: 10000 }),
    tx({ id: 'sell-before', type: 'SELL', date: '2024-06-03', quantity: 20, price: 200, price_gbp: 200, total: 4000 }),
    tx({ id: 'sell-after', type: 'SELL', date: '2024-11-15', quantity: 50, price: 200, price_gbp: 200, total: 10000 }),
  ])
  const report = buildCalculateReport(result, OPTIONS)

  it('reports the gains left at the new rates after losses and the AEA', () => {
    // After: 50 x (200 - 100) = 5,000 gain, less the 3,000 AEA = 2,000 at the new rates
    expect(report.taxYears[0].rateChange2024).toMatchObject({
      gainsAfterGbp: 5000,
      chargeableGainsAfterGbp: 2000,
      adjustmentRequired: true,
    })
  })

  it('shows that figure in the text output', async () => {
    const { formatCalculateText } = await import('../format')
    // The text output lists the input files, so give it one
    const withInput = { ...report, inputs: [{ file: 'trades.csv', broker: report.inputs[0]?.broker ?? ('generic' as never), transactions: 3 }] }
    expect(formatCalculateText(withInput)).toContain('£2,000.00 of gains from 2024-10-30 remain chargeable')
  })
})
