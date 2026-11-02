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
