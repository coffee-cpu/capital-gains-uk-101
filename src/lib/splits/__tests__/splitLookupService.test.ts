import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAutoSplitsForTransactions } from '../splitLookupService'
import { SplitDataSource, SplitRecord } from '../splitDataSource'
import { GenericTransaction } from '../../../types/transaction'

/** Helper to create a minimal GenericTransaction */
function makeTx(overrides: Partial<GenericTransaction> & { id: string; symbol: string; date: string; type: string }): GenericTransaction {
  return {
    source: 'Test Broker',
    name: null,
    quantity: 10,
    price: 100,
    currency: 'USD',
    total: 1000,
    fee: 0,
    notes: null,
    ...overrides,
  } as GenericTransaction
}

/** Mock data source for tests */
class MockSplitSource implements SplitDataSource {
  constructor(private splits: SplitRecord[]) {}

  fetchSplitsForYears = vi.fn(async (_years: number[]): Promise<SplitRecord[]> => {
    return this.splits
  })
}

describe('getAutoSplitsForTransactions', () => {
  let mockSource: MockSplitSource

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('filters splits to only symbols the user holds', async () => {
    mockSource = new MockSplitSource([
      { symbol: 'AAPL', date: '2020-08-28', ratioFrom: 1, ratioTo: 4, name: 'Apple Inc.' },
      { symbol: 'NVDA', date: '2021-07-20', ratioFrom: 1, ratioTo: 4, name: 'NVIDIA' },
      { symbol: 'TSLA', date: '2020-08-31', ratioFrom: 1, ratioTo: 5, name: 'Tesla' },
    ])

    const transactions = [
      makeTx({ id: '1', symbol: 'AAPL', date: '2019-06-01', type: 'BUY' }),
    ]

    const result = await getAutoSplitsForTransactions(transactions, mockSource)

    expect(result).toHaveLength(1)
    expect(result[0].symbol).toBe('AAPL')
  })

  it('deduplicates against broker-provided STOCK_SPLIT records', async () => {
    mockSource = new MockSplitSource([
      { symbol: 'AAPL', date: '2020-08-28', ratioFrom: 1, ratioTo: 4 },
      { symbol: 'AAPL', date: '2014-06-09', ratioFrom: 1, ratioTo: 7 },
    ])

    const transactions = [
      makeTx({ id: '1', symbol: 'AAPL', date: '2013-01-01', type: 'BUY' }),
      // Broker already has this split
      makeTx({ id: '2', symbol: 'AAPL', date: '2020-08-28', type: 'STOCK_SPLIT', ratio: '4:1', quantity: null, price: null, total: null }),
    ]

    const result = await getAutoSplitsForTransactions(transactions, mockSource)

    // Only the 2014 split should be returned (2020 is already in broker data)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2014-06-09')
    expect(result[0].ratio).toBe('7:1')
  })

  it('produces correct synthetic transaction shape', async () => {
    mockSource = new MockSplitSource([
      { symbol: 'TSLA', date: '2020-08-31', ratioFrom: 1, ratioTo: 5, name: 'Tesla Inc.', notes: 'Forward split' },
    ])

    const transactions = [
      makeTx({ id: '1', symbol: 'TSLA', date: '2019-01-01', type: 'BUY' }),
    ]

    const result = await getAutoSplitsForTransactions(transactions, mockSource)

    expect(result).toHaveLength(1)
    const split = result[0]
    expect(split.id).toBe('auto-split-TSLA-2020-08-31')
    expect(split.source).toBe('Auto-detected')
    expect(split.type).toBe('STOCK_SPLIT')
    expect(split.symbol).toBe('TSLA')
    expect(split.date).toBe('2020-08-31')
    expect(split.ratio).toBe('5:1')
    expect(split.name).toBe('Tesla Inc.')
    expect(split.notes).toBe('Forward split')
    expect(split.quantity).toBeNull()
    expect(split.price).toBeNull()
    expect(split.total).toBeNull()
    expect(split.fee).toBeNull()
    expect(split.currency).toBe('GBP')
  })

  it('derives correct year range from transactions', async () => {
    mockSource = new MockSplitSource([])

    const transactions = [
      makeTx({ id: '1', symbol: 'AAPL', date: '2019-03-15', type: 'BUY' }),
      makeTx({ id: '2', symbol: 'AAPL', date: '2023-11-20', type: 'SELL' }),
    ]

    await getAutoSplitsForTransactions(transactions, mockSource)

    // Should request years 2019 through current year
    const calledYears = mockSource.fetchSplitsForYears.mock.calls[0][0]
    expect(calledYears[0]).toBe(2019)
    expect(calledYears).toContain(2020)
    expect(calledYears).toContain(2021)
    expect(calledYears).toContain(2022)
    expect(calledYears).toContain(2023)
    // Should extend to current year
    expect(calledYears[calledYears.length - 1]).toBe(new Date().getFullYear())
  })

  it('returns empty array when data source throws', async () => {
    const failingSource: SplitDataSource = {
      fetchSplitsForYears: vi.fn(async () => {
        throw new Error('Network failure')
      }),
    }

    const transactions = [
      makeTx({ id: '1', symbol: 'AAPL', date: '2020-01-01', type: 'BUY' }),
    ]

    const result = await getAutoSplitsForTransactions(transactions, failingSource)
    expect(result).toEqual([])
  })

  it('returns empty array when no BUY/SELL transactions exist', async () => {
    mockSource = new MockSplitSource([
      { symbol: 'AAPL', date: '2020-08-28', ratioFrom: 1, ratioTo: 4 },
    ])

    const transactions = [
      makeTx({ id: '1', symbol: 'AAPL', date: '2020-06-01', type: 'DIVIDEND' }),
      makeTx({ id: '2', symbol: 'AAPL', date: '2020-07-01', type: 'INTEREST' }),
    ]

    const result = await getAutoSplitsForTransactions(transactions, mockSource)
    expect(result).toEqual([])
    expect(mockSource.fetchSplitsForYears).not.toHaveBeenCalled()
  })

  it('handles multiple splits for the same symbol', async () => {
    mockSource = new MockSplitSource([
      { symbol: 'TSLA', date: '2020-08-31', ratioFrom: 1, ratioTo: 5 },
      { symbol: 'TSLA', date: '2022-08-24', ratioFrom: 1, ratioTo: 3 },
    ])

    const transactions = [
      makeTx({ id: '1', symbol: 'TSLA', date: '2019-01-01', type: 'BUY' }),
    ]

    const result = await getAutoSplitsForTransactions(transactions, mockSource)

    expect(result).toHaveLength(2)
    expect(result[0].ratio).toBe('5:1')
    expect(result[0].date).toBe('2020-08-31')
    expect(result[1].ratio).toBe('3:1')
    expect(result[1].date).toBe('2022-08-24')
  })

  it('deduplicates with fuzzy date matching (±7 days)', async () => {
    mockSource = new MockSplitSource([
      // CDN says AAPL split was on 2020-08-28 (ex-date)
      { symbol: 'AAPL', date: '2020-08-28', ratioFrom: 1, ratioTo: 4 },
    ])

    const transactions = [
      makeTx({ id: '1', symbol: 'AAPL', date: '2019-01-01', type: 'BUY' }),
      // Broker records it as 2020-08-31 (effective date, 3 days later)
      makeTx({ id: '2', symbol: 'AAPL', date: '2020-08-31', type: 'STOCK_SPLIT', ratio: '4:1', quantity: null, price: null, total: null }),
    ]

    const result = await getAutoSplitsForTransactions(transactions, mockSource)

    // Should be deduplicated despite different dates (within 7 days)
    expect(result).toHaveLength(0)
  })

  it('returns empty array when transactions array is empty', async () => {
    mockSource = new MockSplitSource([])
    const result = await getAutoSplitsForTransactions([], mockSource)
    expect(result).toEqual([])
  })

  it('handles reverse splits correctly', async () => {
    mockSource = new MockSplitSource([
      { symbol: 'XYZ', date: '2023-05-15', ratioFrom: 20, ratioTo: 1 },
    ])

    const transactions = [
      makeTx({ id: '1', symbol: 'XYZ', date: '2022-01-01', type: 'BUY' }),
    ]

    const result = await getAutoSplitsForTransactions(transactions, mockSource)

    expect(result).toHaveLength(1)
    expect(result[0].ratio).toBe('1:20')
  })
})
