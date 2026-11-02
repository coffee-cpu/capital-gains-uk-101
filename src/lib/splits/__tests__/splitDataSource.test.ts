import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isValidSplitRecord, JsDelivrSplitSource, MAX_SPLIT_MULTIPLIER } from '../splitDataSource'
import { createMemoryCacheBackends, setCacheBackends } from '../../cache'

const TODAY = '2026-11-02'
const record = (overrides: Record<string, unknown> = {}) => ({
  symbol: 'NVDA', date: '2024-06-10', ratioNew: 10, ratioOld: 1, ...overrides,
})

describe('isValidSplitRecord', () => {
  it('accepts a normal forward or reverse split', () => {
    expect(isValidSplitRecord(record(), 2024, TODAY)).toBe(true)
    expect(isValidSplitRecord(record({ ratioNew: 1, ratioOld: 20 }), 2024, TODAY)).toBe(true)
    expect(isValidSplitRecord(record({ ratioNew: 3, ratioOld: 2 }), 2024, TODAY)).toBe(true)
  })

  it('rejects ratios beyond the sanity limit either way', () => {
    expect(isValidSplitRecord(record({ ratioNew: MAX_SPLIT_MULTIPLIER + 1 }), 2024, TODAY)).toBe(false)
    expect(isValidSplitRecord(record({ ratioNew: 1, ratioOld: MAX_SPLIT_MULTIPLIER + 1 }), 2024, TODAY)).toBe(false)
  })

  it('rejects missing, zero, negative or non-numeric ratios', () => {
    expect(isValidSplitRecord(record({ ratioNew: 0 }), 2024, TODAY)).toBe(false)
    expect(isValidSplitRecord(record({ ratioOld: -1 }), 2024, TODAY)).toBe(false)
    expect(isValidSplitRecord(record({ ratioNew: '10' }), 2024, TODAY)).toBe(false)
    expect(isValidSplitRecord(record({ ratioNew: Infinity }), 2024, TODAY)).toBe(false)
  })

  it('rejects invalid dates and dates outside the year file', () => {
    expect(isValidSplitRecord(record({ date: '2024-02-30' }), 2024, TODAY)).toBe(false)
    expect(isValidSplitRecord(record({ date: '06/10/2024' }), 2024, TODAY)).toBe(false)
    expect(isValidSplitRecord(record({ date: '2023-06-10' }), 2024, TODAY)).toBe(false)
  })

  it('rejects splits that have not happened yet', () => {
    expect(isValidSplitRecord(record({ date: '2026-11-03' }), 2026, TODAY)).toBe(false)
    expect(isValidSplitRecord(record({ date: TODAY }), 2026, TODAY)).toBe(true)
  })

  it('rejects a missing symbol', () => {
    expect(isValidSplitRecord(record({ symbol: '' }), 2024, TODAY)).toBe(false)
    expect(isValidSplitRecord(record({ symbol: undefined }), 2024, TODAY)).toBe(false)
  })
})

describe('JsDelivrSplitSource', () => {
  beforeEach(() => {
    setCacheBackends(createMemoryCacheBackends())
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('drops invalid records from fetched data and keeps valid ones', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      year: 2024,
      updated: '2024-12-31',
      splits: [
        record(),
        record({ symbol: 'BAD', ratioNew: 1_000_000 }),
        record({ symbol: 'MISFILED', date: '2023-01-05' }),
      ],
    })))

    const splits = await new JsDelivrSplitSource().fetchSplitsForYears([2024])

    expect(splits.map(s => s.symbol)).toEqual(['NVDA'])
  })

  it('records rejected records for callers to report, except future-dated ones', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => new Response(JSON.stringify(
      String(url).endsWith('/2099.json')
        ? { year: 2099, updated: '2099-01-01', splits: [record({ symbol: 'LATER', date: '2099-01-01' })] }
        : { year: 2024, updated: '2024-12-31', splits: [record({ symbol: 'BAD', ratioNew: 1_000_000 })] }
    )))
    const source = new JsDelivrSplitSource()

    await source.fetchSplitsForYears([2024, 2099])

    expect(source.rejectedRecords).toEqual([
      { symbol: 'BAD', date: '2024-06-10', year: 2024, reason: 'ratio-out-of-range' },
    ])
  })
})
