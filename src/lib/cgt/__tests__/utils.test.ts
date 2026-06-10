import { describe, it, expect } from 'vitest'
import { calculateCostBasis, calculateNetProceeds, getFeePerUnit } from '../utils'
import { EnrichedTransaction, TransactionType } from '../../../types/transaction'

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

  it('deducts the full fee from proceeds for fractional disposals', () => {
    const sell = makeTx({ type: TransactionType.SELL, quantity: 0.25, price_gbp: 200, fee_gbp: 1 })

    expect(calculateNetProceeds(sell, 0.25)).toBeCloseTo(0.25 * 200 - 1)
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
