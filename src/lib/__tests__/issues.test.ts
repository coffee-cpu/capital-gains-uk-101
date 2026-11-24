import { describe, it, expect } from 'vitest'
import { findDataIssues } from '../issues'
import type { EnrichedTransaction } from '../../types/transaction'
import type { DataNotices, DisposalRecord } from '../../types/cgt'

function tx(overrides: Partial<EnrichedTransaction> = {}): EnrichedTransaction {
  return {
    id: 'tx-1',
    source: 'Test Broker',
    symbol: 'ACME',
    name: null,
    date: '2024-06-10',
    type: 'BUY',
    quantity: 10,
    price: 100,
    currency: 'USD',
    total: 1000,
    fee: 0,
    notes: null,
    fx_rate: 1.25,
    price_gbp: 80,
    value_gbp: 800,
    fee_gbp: 0,
    fx_source: 'HMRC Monthly',
    tax_year: '2024/25',
    ...overrides,
  }
}

function disposal(id: string, isIncomplete: boolean): DisposalRecord {
  return {
    id: `disposal-${id}`,
    disposal: tx({ id, type: 'SELL' }),
    matchings: [],
    proceedsGbp: 0,
    allowableCostsGbp: 0,
    gainOrLossGbp: 0,
    taxYear: '2024/25',
    isIncomplete,
  }
}

const NO_NOTICES: DataNotices = { overlappingRows: [], splitConflicts: [] }


const codes = (issues: { code: string }[]) => issues.map(i => i.code)

describe('findDataIssues', () => {
  it('returns nothing for clean data', () => {
    expect(findDataIssues({ transactions: [tx()], disposals: [disposal('s1', false)], dataNotices: NO_NOTICES })).toEqual([])
  })

  it('lists the affected transactions', () => {
    const failed = tx({ id: 'fx', fx_error: 'No rate' })
    const unknown = tx({ id: 'unk', type: 'UNKNOWN' })
    const issues = findDataIssues({ transactions: [tx(), failed, unknown], disposals: [disposal('s2', true)] })

    expect(issues.map(i => [i.code, i.transactionIds])).toEqual([
      ['FX_RATE_MISSING', ['fx']],
      ['INCOMPLETE_DISPOSAL', ['s2']],
      ['UNKNOWN_TRANSACTION_TYPE', ['unk']],
    ])
  })

  it('lists FX failures per currency and rejected splits with a plain reason', () => {
    const [fx, rejected] = findDataIssues({
      transactions: [
        tx({ id: 'a', fx_error: 'No rate for May' }),
        tx({ id: 'b', fx_error: 'Timeout' }),
        tx({ id: 'c', currency: 'EUR', fx_error: 'No rate for June' }),
      ],
      disposals: [],
      dataNotices: { ...NO_NOTICES, rejectedSplitRecords: [{ symbol: 'ACME', date: '2024-06-10', reason: 'ratio-out-of-range' }] },
    })

    expect(fx.details).toEqual([
      'USD: 2 transactions (first error: No rate for May)',
      'EUR: 1 transaction (first error: No rate for June)',
    ])
    expect(rejected.details).toEqual(['ACME 2024-06-10: ratio too large or too small to be plausible'])
  })

  it('agrees in number with one affected item or several', () => {
    const unknownIssue = (n: number) => findDataIssues({
      transactions: Array.from({ length: n }, (_, i) => tx({ id: `u${i}`, type: 'UNKNOWN' })),
      disposals: [],
    })[0]

    expect(unknownIssue(1).description).toMatch(/^1 transaction has a type .* and was left out/)
    expect(unknownIssue(1).remedy!.web).toMatch(/^If it is a trade/)
    expect(unknownIssue(2).description).toMatch(/^2 transactions have a type .* and were left out/)
    expect(unknownIssue(2).remedy!.web).toMatch(/^If any of them is a trade/)

    const fx = (n: number) => findDataIssues({
      transactions: Array.from({ length: n }, (_, i) => tx({ id: `f${i}`, fx_error: 'No rate' })),
      disposals: [],
    })[0].description
    expect(fx(1)).toContain('its GBP value is missing and totals that include it are wrong')
    expect(fx(2)).toContain('their GBP values are missing and totals that include them are wrong')
  })

  it('checks only the disposals it is given', () => {
    expect(findDataIssues({ transactions: [], disposals: [disposal('s1', false)] })).toEqual([])
  })

  it('gives each channel its own remedy for a split without a ratio', () => {
    const remedy = (notices: Partial<DataNotices>) => findDataIssues({
      transactions: [],
      disposals: [],
      dataNotices: {
        ...NO_NOTICES,
        splitsWithoutRatio: [{ id: 'sp', symbol: 'ACME', date: '2024-06-10', source: 'Test Broker' }],
        ...notices,
      },
    }).find(i => i.code === 'SPLIT_WITHOUT_RATIO')!.remedy!

    expect(remedy({ autoSplits: false }).web).toContain('Turn on "Community split data"')
    expect(remedy({ autoSplits: false }).cli).toContain('without --no-auto-splits')
    expect(remedy({ autoSplits: true, splitDataUnavailableYears: [2024] }).cli).toContain('see SPLIT_DATA_UNAVAILABLE')
    expect(remedy({ autoSplits: true }).cli).toContain("Community split data doesn't have this split")
  })

  it('reports split data that could not be downloaded, by year', () => {
    const [issue] = findDataIssues({
      transactions: [],
      disposals: [],
      dataNotices: { ...NO_NOTICES, splitDataUnavailableYears: [2023, 2024] },
    })
    expect(issue.code).toBe('SPLIT_DATA_UNAVAILABLE')
    expect(issue.description).toContain('for 2023, 2024')
  })

  it('reports skipped rows per file, with no remedy when they are all exempt', () => {
    const issueFor = (exempt: boolean) => findDataIssues({
      transactions: [],
      disposals: [],
      skippedRows: [
        { file: 'a.csv', rows: [{ row: 3, reason: 'bad date', exempt }] },
        { file: 'b.csv', rows: [] },
      ],
    })[0]

    expect(issueFor(false).code).toBe('SKIPPED_ROWS')
    expect(issueFor(false).description).toContain('"a.csv" (row 3: bad date)')
    expect(issueFor(false).description).not.toContain('b.csv')
    expect(issueFor(false).remedy).toBeDefined()
    expect(issueFor(true).description).toContain('the totals are unaffected')
    expect(issueFor(true).remedy).toBeUndefined()
  })

  it('notes a history with purchases but no sales', () => {
    const issues = findDataIssues({
      transactions: [tx()],
      disposals: [],
      metadata: { calculatedAt: '', totalTransactions: 1, totalBuys: 1, totalSells: 0 },
    })
    expect(codes(issues)).toEqual(['NO_DISPOSALS'])
  })

  it('lists errors first, then warnings, then notices', () => {
    const issues = findDataIssues({
      transactions: [tx({ id: 'fx', fx_error: 'No rate' }), tx({ id: 'sp', incomplete: true })],
      disposals: [],
      dataNotices: {
        overlappingRows: [tx({ id: 'dup' })],
        splitConflicts: [{
          symbol: 'ACME',
          used: { id: 'u', date: '2024-06-10', ratio: '2:1', source: 'A' },
          ignored: { id: 'i', date: '2024-06-11', ratio: '3:1', source: 'B' },
        }],
        symbolMerges: [{ isin: 'XX0000000001', symbol: 'ACME', mergedSymbols: ['ACM'] }],
      },
    })
    expect(issues.map(i => [i.code, i.severity])).toEqual([
      ['FX_RATE_MISSING', 'error'],
      ['SPLIT_RATIO_CONFLICT', 'warning'],
      ['INCOMPLETE_STOCK_PLAN', 'warning'],
      ['OVERLAPPING_ROWS_REMOVED', 'info'],
      ['SYMBOLS_MATCHED_BY_ISIN', 'info'],
    ])
  })
})
