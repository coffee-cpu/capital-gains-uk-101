import { describe, it, expect } from 'vitest'
import { addDaysToISODate, allocateProRata, calculateCostBasis, calculateDisposalFees, calculateGrossProceeds, createMatching, getFeePerUnit, groupBy, isFullyUnmatched, matchedAcquisition, MatchedQuantityTracker } from '../utils'
import { EnrichedTransaction, TransactionType } from '../../../types/transaction'
import type { DisposalRecord } from '../../../types/cgt'

function makeTx(overrides: Partial<EnrichedTransaction>): EnrichedTransaction {
  return {
    id: 'tx-1',
    source: 'Test',
    symbol: 'TEST',
    name: 'Test Stock',
    date: '2024-01-10',
    type: TransactionType.BUY,
    quantity: 1,
    price: 100,
    currency: 'GBP',
    total: 100,
    fee: 0,
    notes: null,
    fx_rate: 1,
    price_gbp: 100,
    value_gbp: 100,
    fee_gbp: 0,
    fx_source: 'Test',
    tax_year: '2023/24',
    match_groups: [],
    ...overrides,
  } as EnrichedTransaction
}

describe('CGT utils fee apportionment', () => {
  it('apportions the full fee for fractional quantities (< 1 share)', () => {
    // Regression: a Math.max(qty, 1) clamp used to halve the fee for 0.5 shares
    const buy = makeTx({ quantity: 0.5, price_gbp: 100, fee_gbp: 1 })

    expect(getFeePerUnit(buy)).toBeCloseTo(2) // £1 fee over 0.5 shares = £2/share

    // Matching the full 0.5 shares must include the entire £1 fee
    expect(calculateCostBasis(buy, 0.5)).toBeCloseTo(0.5 * 100 + 1)
  })

  it('apportions the full selling fee for fractional disposals, with proceeds gross', () => {
    const sell = makeTx({ type: TransactionType.SELL, quantity: 0.25, price_gbp: 200, fee_gbp: 1 })

    expect(calculateGrossProceeds(sell, 0.25)).toBeCloseTo(0.25 * 200)
    expect(calculateDisposalFees(sell, 0.25)).toBeCloseTo(1)
  })

  it('apportions fees per-share for integer quantities (unchanged behaviour)', () => {
    const buy = makeTx({ quantity: 10, price_gbp: 50, fee_gbp: 5 })

    expect(getFeePerUnit(buy)).toBeCloseTo(0.5)
    expect(calculateCostBasis(buy, 4)).toBeCloseTo(4 * 50.5)
  })

  it('spreads fees over contract size for options', () => {
    const buy = makeTx({ quantity: 2, price_gbp: 1, fee_gbp: 2, contract_size: 100 })

    expect(getFeePerUnit(buy)).toBeCloseTo(2 / 200)
    // 1 contract = 100 shares at £1 + £0.01/share fee
    expect(calculateCostBasis(buy, 1)).toBeCloseTo(101)
  })

  it('returns zero fee when quantity is zero', () => {
    const buy = makeTx({ quantity: 0, fee_gbp: 5 })

    expect(getFeePerUnit(buy)).toBe(0)
  })
})

describe('addDaysToISODate', () => {
  it('adds days across month, year and DST boundaries', () => {
    expect(addDaysToISODate('2024-03-20', 30)).toBe('2024-04-19')
    expect(addDaysToISODate('2024-10-10', 30)).toBe('2024-11-09')
    expect(addDaysToISODate('2023-12-15', 30)).toBe('2024-01-14')
    expect(addDaysToISODate('2024-02-15', 30)).toBe('2024-03-16') // leap year
  })
})

describe('allocateProRata', () => {
  const a = makeTx({ id: 'a' })
  const b = makeTx({ id: 'b' })
  const c = makeTx({ id: 'c' })

  it('returns every available quantity when asked for at least the total', () => {
    const result = allocateProRata([{ transaction: a, available: 10 }, { transaction: b, available: 30 }], 50)
    expect(result.map(r => r.quantity)).toEqual([10, 30])
  })

  it('splits a partial quantity in proportion to availability', () => {
    const result = allocateProRata([{ transaction: a, available: 10 }, { transaction: b, available: 30 }], 20)
    expect(result.map(r => r.quantity)).toEqual([5, 15])
  })

  it('gives the last item the remainder so the parts sum exactly', () => {
    const result = allocateProRata(
      [{ transaction: a, available: 0.1 }, { transaction: b, available: 0.2 }, { transaction: c, available: 0.3 }],
      0.35
    )
    expect(result.reduce((sum, r) => sum + r.quantity, 0)).toBe(0.35)
    result.forEach(r => expect(r.quantity).toBeGreaterThanOrEqual(0))
  })
})

describe('isFullyUnmatched', () => {
  const disposal = (overrides: Partial<EnrichedTransaction>) =>
    ({ id: 's', type: 'SELL', quantity: 10, ...overrides }) as EnrichedTransaction
  const record = (tx: EnrichedTransaction, unmatchedQuantity?: number) =>
    ({ disposal: tx, unmatchedQuantity, isIncomplete: unmatchedQuantity !== undefined }) as DisposalRecord

  it('is true when the whole disposal is unmatched', () => {
    expect(isFullyUnmatched(record(disposal({}), 10))).toBe(true)
  })

  it('compares against the split-adjusted quantity', () => {
    expect(isFullyUnmatched(record(disposal({ split_adjusted_quantity: 40 }), 40))).toBe(true)
    expect(isFullyUnmatched(record(disposal({ split_adjusted_quantity: 40 }), 10))).toBe(false)
  })

  it('tolerates floating-point residue', () => {
    expect(isFullyUnmatched(record(disposal({ quantity: 0.3 }), 0.1 + 0.2 - 1e-12))).toBe(true)
  })

  it('is false for partial or complete matches', () => {
    expect(isFullyUnmatched(record(disposal({}), 4))).toBe(false)
    expect(isFullyUnmatched(record(disposal({})))).toBe(false)
  })
})

describe('groupBy', () => {
  it('keeps input order within groups and first-seen order of keys', () => {
    const groups = groupBy(['b1', 'a1', 'b2', 'a2'], s => s[0])
    expect([...groups.keys()]).toEqual(['b', 'a'])
    expect(groups.get('b')).toEqual(['b1', 'b2'])
  })
})

describe('MatchedQuantityTracker.withRemaining', () => {
  it('lists unmatched quantities and drops fully matched transactions', () => {
    const buyA = makeTx({ id: 'a', type: TransactionType.BUY, quantity: 10 })
    const buyB = makeTx({ id: 'b', type: TransactionType.BUY, quantity: 5 })
    const sell = makeTx({ id: 's', type: TransactionType.SELL, quantity: 9 })
    const tracker = new MatchedQuantityTracker([
      createMatching('SAME_DAY', sell, [matchedAcquisition(buyA, 4), matchedAcquisition(buyB, 5)], 9),
    ])

    expect(tracker.withRemaining([buyA, buyB])).toEqual([{ transaction: buyA, available: 6 }])
  })
})

describe('createMatching', () => {
  it('totals the acquisitions\' cost basis and keeps the stated quantity', () => {
    const buy = makeTx({ id: 'b', type: TransactionType.BUY, quantity: 10 })
    const sell = makeTx({ id: 's', type: TransactionType.SELL, quantity: 3 })
    const acquisitions = [matchedAcquisition(buy, 1), matchedAcquisition(buy, 2)]

    const matching = createMatching('30_DAY', sell, acquisitions, 3)

    expect(matching.rule).toBe('30_DAY')
    expect(matching.quantityMatched).toBe(3)
    expect(matching.totalCostBasisGbp).toBeCloseTo(acquisitions[0].costBasisGbp + acquisitions[1].costBasisGbp)
    expect(acquisitions[1].costBasisGbp).toBeCloseTo(calculateCostBasis(buy, 2))
  })
})

