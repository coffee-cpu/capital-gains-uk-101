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

describe('findDataIssues', () => {
  it('returns nothing for clean data', () => {
    expect(findDataIssues({ transactions: [tx()], disposals: [disposal('s1', false)], dataNotices: NO_NOTICES })).toEqual([])
  })

  it('collects transactions with FX errors and of unknown type', () => {
    const failed = tx({ id: 'fx', fx_error: 'No rate' })
    const unknown = tx({ id: 'unk', type: 'UNKNOWN' })
    const issues = findDataIssues({ transactions: [tx(), failed, unknown], disposals: [] })
    expect(issues).toEqual([
      { code: 'FX_RATE_MISSING', severity: 'error', transactions: [failed] },
      { code: 'UNKNOWN_TRANSACTION_TYPE', severity: 'warning', transactions: [unknown] },
    ])
  })

  it('checks only the disposals it is given', () => {
    const incomplete = disposal('s2', true)
    const issues = findDataIssues({ transactions: [], disposals: [disposal('s1', false), incomplete] })
    expect(issues).toEqual([{ code: 'INCOMPLETE_DISPOSAL', severity: 'error', disposals: [incomplete] }])
  })

  it.each([
    [{ autoSplits: false }, 'enable-auto-splits'],
    [{ autoSplits: true, splitDataUnavailable: true }, 'retry-split-data'],
    [{ autoSplits: true }, 'add-split-row'],
  ] as const)('picks the remedy for a split without a ratio (%o)', (notices, remedy) => {
    const splits = [{ id: 'sp', symbol: 'ACME', date: '2024-06-10', source: 'Test Broker' }]
    const [issue] = findDataIssues({
      transactions: [],
      disposals: [],
      dataNotices: { ...NO_NOTICES, ...notices, splitsWithoutRatio: splits },
    })
    expect(issue).toEqual({ code: 'SPLIT_WITHOUT_RATIO', severity: 'warning', splits, remedy })
  })

  it('lists the data notices in a fixed order', () => {
    const row = tx({ id: 'dup' })
    const issues = findDataIssues({
      transactions: [],
      disposals: [],
      dataNotices: {
        overlappingRows: [row],
        importOverlaps: [{ droppedFileId: 'b', keptFileId: 'a', rows: 1, firstDate: '2024-06-10', lastDate: '2024-06-10' }],
        splitConflicts: [{
          symbol: 'ACME',
          used: { id: 'u', date: '2024-06-10', ratio: '2:1', source: 'A' },
          ignored: { id: 'i', date: '2024-06-11', ratio: '3:1', source: 'B' },
        }],
        rejectedSplitRecords: [{ symbol: 'ACME', date: '2024-06-10', reason: 'bad ratio' }],
        symbolMerges: [{ isin: 'XX0000000001', symbol: 'ACME', mergedSymbols: ['ACM'] }],
        tickerConflicts: [{ symbol: 'ACME', isins: ['XX0000000001', 'XX0000000002'], pooledSeparately: false }],
      },
    })
    expect(issues.map(i => [i.code, i.severity])).toEqual([
      ['OVERLAPPING_ROWS_REMOVED', 'info'],
      ['SPLIT_RATIO_CONFLICT', 'warning'],
      ['SPLIT_DATA_REJECTED', 'warning'],
      ['SYMBOLS_MATCHED_BY_ISIN', 'info'],
      ['TICKER_ISIN_CONFLICT', 'warning'],
    ])
  })
})
