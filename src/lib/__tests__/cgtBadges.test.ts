import { describe, it, expect } from 'vitest'
import { calculateCGT } from '../cgt/engine'
import { buildBadgeIndex, buildCGTBadges } from '../cgtBadges'
import { EnrichedTransaction } from '../../types/transaction'
import { getTaxYear } from '../../utils/taxYear'

function tx(id: string, date: string, type: 'BUY' | 'SELL', quantity: number, priceGbp: number,
  extra: Partial<EnrichedTransaction> = {}): EnrichedTransaction {
  return {
    id, source: 'test', symbol: 'AAPL', name: null, date, type, quantity, price: priceGbp,
    currency: 'GBP', total: quantity * priceGbp, fee: null, notes: null,
    fx_rate: 1, price_gbp: priceGbp, value_gbp: quantity * priceGbp, fee_gbp: null,
    fx_source: 'Native GBP', fx_error: null, tax_year: getTaxYear(date),
    ...extra,
  }
}

function badgesFor(transactions: EnrichedTransaction[]) {
  const result = calculateCGT(transactions)
  const index = buildBadgeIndex(result.disposals, result.section104Pools)
  return (id: string) => buildCGTBadges(result.transactions.find(t => t.id === id)!, index)
}

describe('buildCGTBadges', () => {
  it('labels same-day, 30-day and Section 104 matches on both sides', () => {
    const badges = badgesFor([
      tx('pool', '2023-01-10', 'BUY', 100, 10),
      tx('sell', '2023-06-01', 'SELL', 30, 12),
      tx('same', '2023-06-01', 'BUY', 10, 11),
      tx('bnb', '2023-06-10', 'BUY', 5, 11.5),
    ])

    expect(badges('sell').map(b => b.label)).toEqual(['Same Day', '30-Day', 'Section 104'])
    expect(badges('sell')[0].title).toBe('Same Day: Matched 10.00 shares bought on same day (TCGA92/S105(1))')
    expect(badges('sell')[2].title).toBe('Section 104: Matched 15.00 shares at average cost £10.00/share from pooled holdings')
    expect(badges('same').map(b => b.kind)).toEqual(['SAME_DAY'])
    expect(badges('bnb')[0].title).toBe('30-Day: 5.00 shares matched to disposal (bed & breakfast rule TCGA92/S106A(5))')
    expect(badges('pool')[0].title).toBe(
      'Section 104: 100.00 shares added to pool (new balance: 100.00 shares at £10.00/share average cost)'
    )
  })

  it('warns about an incomplete disposal, with original and split-adjusted quantities', () => {
    const badges = badgesFor([
      tx('sell', '2023-06-01', 'SELL', 5, 12, { split_multiplier: 2, split_adjusted_quantity: 10 }),
    ])

    const [warning] = badges('sell')
    expect(warning.kind).toBe('INCOMPLETE')
    expect(warning.helpContext).toBe('incomplete')
    expect(warning.title).toContain('Warning: 5.00 shares (10.00 split-adjusted) could not be matched')
  })

  it('gives no badges to transactions that are neither acquisitions nor disposals', () => {
    const badges = badgesFor([tx('div', '2023-06-01', 'BUY', 1, 1, { type: 'DIVIDEND' })])
    expect(badges('div')).toEqual([])
  })
})
