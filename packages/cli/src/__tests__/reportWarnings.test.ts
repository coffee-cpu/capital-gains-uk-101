// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildCalculateReport } from '../report'
import { calculateCGT } from '../../../../src/lib/cgt/engine'
import type { EnrichedTransaction } from '../../../../src/types/transaction'

describe('buildCalculateReport - rejected split data', () => {
  it('warns with SPLIT_DATA_REJECTED for each held share whose split data was rejected', () => {
    const buy = {
      id: 'b', source: 'Generic CSV', symbol: 'VOD', name: null, date: '2023-05-01', type: 'BUY',
      quantity: 100, price: 1, currency: 'GBP', total: 100, fee: 0, notes: null,
      fx_rate: 1, price_gbp: 1, value_gbp: 100, fee_gbp: 0, fx_source: 'Native GBP', fx_error: null,
      tax_year: '2023/24',
    } as EnrichedTransaction
    const result = calculateCGT([buy])
    result.dataNotices = {
      overlappingRows: [],
      splitConflicts: [],
      rejectedSplitRecords: [{ symbol: 'VOD', date: '2023-07-01', reason: 'ratio-out-of-range' }],
    }

    const report = buildCalculateReport(result, {
      taxYear: null, fxSource: 'HMRC_MONTHLY', autoSplits: true, offline: false,
      details: false, inputs: [], warnings: [],
    })
    const warning = report.warnings.find(w => w.code === 'SPLIT_DATA_REJECTED')!

    expect(warning.message).toContain('VOD on 2023-07-01 (ratio-out-of-range)')
  })
})

describe('buildCalculateReport - stock splits without a ratio', () => {
  it('warns with SPLIT_WITHOUT_RATIO and the split rows', () => {
    const result = calculateCGT([])
    result.dataNotices = {
      overlappingRows: [],
      splitConflicts: [],
      splitsWithoutRatio: [{ id: 'f-3', symbol: 'AAPL', date: '2024-06-10', source: 'Trading 212' }],
    }

    const report = buildCalculateReport(result, {
      taxYear: null, fxSource: 'HMRC_MONTHLY', autoSplits: false, offline: false,
      details: false, inputs: [], warnings: [],
    })
    const warning = report.warnings.find(w => w.code === 'SPLIT_WITHOUT_RATIO')!

    expect(warning.message).toContain('AAPL on 2024-06-10 (Trading 212)')
    expect(warning.transactionIds).toEqual(['f-3'])
  })

  it('suggests dropping --no-auto-splits only when auto-splits was off', () => {
    const messageFor = (autoSplits: boolean, splitDataUnavailable = false) => {
      const result = calculateCGT([])
      result.dataNotices = {
        overlappingRows: [],
        splitConflicts: [],
        splitsWithoutRatio: [{ id: 'f-3', symbol: 'AAPL', date: '2024-06-10', source: 'Trading 212' }],
        autoSplits,
        splitDataUnavailable,
      }
      const report = buildCalculateReport(result, {
        taxYear: null, fxSource: 'HMRC_MONTHLY', autoSplits, offline: false,
        details: false, inputs: [], warnings: [],
      })
      return report.warnings.find(w => w.code === 'SPLIT_WITHOUT_RATIO')!.message
    }

    expect(messageFor(false)).toContain('without --no-auto-splits')
    expect(messageFor(true)).not.toContain('--no-auto-splits')
    expect(messageFor(true)).toContain("Community split data doesn't have it")

    // Offline or a failed fetch: agree with SPLIT_DATA_UNAVAILABLE instead
    expect(messageFor(true, true)).toContain('could not be fetched')
    expect(messageFor(true, true)).not.toContain("doesn't have it")
  })
})

describe('buildCalculateReport - ISIN matching', () => {
  it('warns when tickers were matched by ISIN or one ticker has two ISINs', () => {
    const result = calculateCGT([])
    result.dataNotices = {
      overlappingRows: [],
      splitConflicts: [],
      symbolMerges: [{ isin: 'IE00B3XXRP09', symbol: 'VUSA', mergedSymbols: ['VUSAL'] }],
      tickerConflicts: [
        { symbol: 'BP', isins: ['GB0007980591', 'US0556221044'], pooledSeparately: true },
        { symbol: 'SHEL', isins: ['GB00B03MLX29', 'GB00BP6MXD84'], pooledSeparately: false },
      ],
    }

    const report = buildCalculateReport(result, {
      taxYear: null, fxSource: 'HMRC_MONTHLY', autoSplits: true, offline: false,
      details: false, inputs: [], warnings: [],
    })

    expect(report.warnings.find(w => w.code === 'SYMBOLS_MATCHED_BY_ISIN')!.message).toContain('VUSAL treated as VUSA')
    const conflicts = report.warnings.filter(w => w.code === 'TICKER_ISIN_CONFLICT').map(w => w.message)
    expect(conflicts[0]).toContain('BP appears with ISINs GB0007980591, US0556221044 at the same time')
    expect(conflicts[1]).toContain('SHEL changed ISIN (GB00B03MLX29 to GB00BP6MXD84)')
  })
})
