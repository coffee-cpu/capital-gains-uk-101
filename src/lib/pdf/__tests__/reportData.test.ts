import { describe, it, expect } from 'vitest'
import { dividendLines, fxSourcesUsed, poolBalancesAt, sa108Category, sa108Rows } from '../reportData'
import type { DisposalRecord, Section104Pool, TaxYearSummary } from '../../../types/cgt'
import type { EnrichedTransaction } from '../../../types/transaction'
import { calculateCGT } from '../../cgt/engine'

function tx(overrides: Partial<EnrichedTransaction>): EnrichedTransaction {
  return {
    id: 'tx',
    source: 'Test',
    date: '2024-05-01',
    type: 'SELL',
    symbol: 'ABC',
    name: null,
    currency: 'GBP',
    quantity: 10,
    price: 5,
    total: 50,
    fee: null,
    notes: null,
    fx_rate: 1,
    price_gbp: 5,
    value_gbp: 50,
    fee_gbp: null,
    fx_source: 'Native GBP',
    tax_year: '2024/25',
    ...overrides,
  } as EnrichedTransaction
}

function record(disposal: EnrichedTransaction, proceeds: number, cost: number): DisposalRecord {
  return {
    id: `disposal-${disposal.id}`,
    disposal,
    matchings: [],
    proceedsGbp: proceeds,
    allowableCostsGbp: cost,
    gainOrLossGbp: proceeds - cost,
    taxYear: disposal.tax_year,
    isIncomplete: false,
  }
}

const summary2024 = { taxYear: '2024/25', startDate: '2024-04-06', endDate: '2025-04-05' } as TaxYearSummary

describe('sa108Category', () => {
  it('classifies options, Coinbase crypto and everything else as listed shares', () => {
    expect(sa108Category(tx({ underlying_symbol: 'NVDA' }))).toBe('OPTIONS')
    expect(sa108Category(tx({ source: 'Coinbase' }))).toBe('CRYPTO')
    expect(sa108Category(tx({ source: 'Coinbase Pro' }))).toBe('CRYPTO')
    expect(sa108Category(tx({ source: 'Trading 212' }))).toBe('LISTED_SHARES')
  })
})

describe('sa108Rows', () => {
  const disposals = [
    record(tx({ id: 'a', symbol: 'AAPL', date: '2024-05-01' }), 1000, 800),
    record(tx({ id: 'b', symbol: 'AAPL', date: '2024-05-01' }), 500, 600),
    record(tx({ id: 'c', symbol: 'MSFT', date: '2024-06-01' }), 300, 100),
    record(tx({ id: 'd', symbol: 'BTC', source: 'Coinbase' }), 200, 250),
    record(tx({ id: 'e', symbol: 'NVDA C', underlying_symbol: 'NVDA' }), 100, 50),
  ]

  it('totals each section and counts same-day disposals of one asset once', () => {
    const [shares, crypto, options] = sa108Rows('2024/25', disposals)
    expect(shares).toMatchObject({
      category: 'LISTED_SHARES',
      section: 'Listed shares and securities',
      numberOfDisposals: 2,
      proceedsGbp: 1800,
      costsGbp: 1500,
      gainsGbp: 400,
      lossesGbp: 100,
    })
    expect(shares.boxes).toEqual({ number: '23', proceeds: '24', costs: '25', gains: '26', losses: '27' })
    expect(crypto).toMatchObject({ category: 'CRYPTO', section: 'Cryptoassets', lossesGbp: 50 })
    expect(crypto.boxes?.number).toBe('13.1')
    expect(options).toMatchObject({ category: 'OPTIONS', section: null, boxes: null })
  })

  it('puts crypto in "Other property, assets and gains" before 2024/25', () => {
    const crypto = sa108Rows('2023/24', disposals).find(r => r.category === 'CRYPTO')
    expect(crypto?.section).toBe('Other property, assets and gains')
    expect(crypto?.boxes).toEqual({ number: '14', proceeds: '15', costs: '16', gains: '17', losses: '19' })
  })

  it('leaves box numbers out for years not checked against the form', () => {
    const rows = sa108Rows('2021/22', disposals)
    expect(rows.every(r => r.boxes === null)).toBe(true)
    expect(rows[0].section).toBe('Listed shares and securities')
  })

  it('omits sections with no disposals', () => {
    expect(sa108Rows('2024/25', disposals.slice(0, 1)).map(r => r.category)).toEqual(['LISTED_SHARES'])
  })
})

describe('dividendLines', () => {
  it('groups by symbol and adds up to the engine totals', () => {
    const transactions = [
      tx({ id: 'd1', type: 'DIVIDEND', symbol: 'AAPL', value_gbp: 8.5, grossDividend_gbp: 10, withholdingTax_gbp: 1.5 }),
      tx({ id: 'd2', type: 'DIVIDEND', symbol: 'AAPL', value_gbp: 5 }),
      tx({ id: 't1', type: 'TAX_ON_DIVIDEND', symbol: 'MSFT', value_gbp: -0.75, source: 'Interactive Brokers' }),
      tx({ id: 'd3', type: 'DIVIDEND', symbol: 'MSFT', value_gbp: 5 }),
      tx({ id: 'old', type: 'DIVIDEND', symbol: 'AAPL', value_gbp: 99, tax_year: '2023/24' }),
    ]
    const lines = dividendLines(summary2024, transactions)
    expect(lines).toEqual([
      { symbol: 'AAPL', grossGbp: 15, withheldGbp: 1.5 },
      { symbol: 'MSFT', grossGbp: 5, withheldGbp: 0.75 },
    ])

    const result = calculateCGT(transactions)
    const engineSummary = result.taxYearSummaries.find(s => s.taxYear === '2024/25')!
    expect(lines.reduce((sum, l) => sum + l.grossGbp, 0)).toBeCloseTo(engineSummary.grossDividendsGbp)
    expect(lines.reduce((sum, l) => sum + l.withheldGbp, 0)).toBeCloseTo(engineSummary.totalWithholdingTaxGbp)
  })
})

describe('poolBalancesAt', () => {
  const pool = (symbol: string, history: Array<[string, number, number]>): Section104Pool => ({
    symbol,
    quantity: 0,
    totalCostGbp: 0,
    averageCostGbp: 0,
    history: history.map(([date, balanceQuantity, balanceCost], i) => ({
      date,
      type: 'BUY',
      quantity: 0,
      costOrProceeds: 0,
      balanceQuantity,
      balanceCost,
      transactionId: `${symbol}-${i}`,
    })),
  })

  it('takes each pool at its last entry on or before the year end', () => {
    const pools = new Map([
      ['AAPL', pool('AAPL', [['2024-01-01', 10, 1000], ['2025-04-05', 6, 600], ['2025-05-01', 20, 3000]])],
      ['SOLD', pool('SOLD', [['2024-01-01', 5, 50], ['2024-06-01', 0, 0]])],
      ['LATER', pool('LATER', [['2025-06-01', 5, 50]])],
    ])
    expect(poolBalancesAt(pools, '2025-04-05')).toEqual([{ symbol: 'AAPL', quantity: 6, costGbp: 600 }])
  })

  it('is empty without pools', () => {
    expect(poolBalancesAt(undefined, '2025-04-05')).toEqual([])
  })
})

describe('fxSourcesUsed', () => {
  it('lists the rate sources behind disposals, matched acquisitions and income, skipping GBP', () => {
    const sell = tx({ id: 's', currency: 'USD', fx_source: 'HMRC Monthly Exchange Rates' })
    const disposal = record(sell, 50, 40)
    disposal.matchings = [{
      disposal: sell,
      rule: 'SECTION_104',
      quantityMatched: 10,
      totalCostBasisGbp: 40,
      acquisitions: [{ transaction: tx({ id: 'b', type: 'BUY', currency: 'EUR', fx_source: 'European Central Bank (via Frankfurter)' }), quantityMatched: 10, costBasisGbp: 40 }],
    }]
    const income = [
      tx({ id: 'div', type: 'DIVIDEND', currency: 'USD', fx_source: 'HMRC Monthly Exchange Rates' }),
      tx({ id: 'gbp', type: 'DIVIDEND', currency: 'GBP', fx_source: 'Native GBP' }),
    ]
    expect(fxSourcesUsed(summary2024, [disposal], income)).toEqual([
      'European Central Bank (via Frankfurter)',
      'HMRC Monthly Exchange Rates',
    ])
  })
})
