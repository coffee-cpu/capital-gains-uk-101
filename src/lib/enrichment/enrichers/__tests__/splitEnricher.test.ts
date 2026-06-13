import { describe, it, expect } from 'vitest'
import { SplitEnricher, extractStockSplits } from '../splitEnricher'
import { EnrichedTransaction, GenericTransaction, TransactionType } from '../../../../types/transaction'

function makeTx(overrides: Partial<GenericTransaction>): EnrichedTransaction {
  return {
    id: 'tx-1',
    source: 'Generic CSV',
    symbol: 'TEST',
    name: null,
    date: '2024-01-15',
    type: TransactionType.BUY,
    quantity: null,
    price: null,
    currency: 'USD',
    total: null,
    fee: null,
    notes: null,
    ratio: null,
    ...overrides,
  } as EnrichedTransaction
}

async function enrich(transactions: EnrichedTransaction[]): Promise<EnrichedTransaction[]> {
  return new SplitEnricher().enrich(transactions)
}

describe('extractStockSplits', () => {
  it('should extract valid stock split events sorted chronologically', () => {
    const transactions = [
      makeTx({ id: 'split-1', symbol: 'NVDA', date: '2024-06-10', type: TransactionType.STOCK_SPLIT, ratio: '10:1' }),
      makeTx({ id: 'split-2', symbol: 'AAPL', date: '2020-08-31', type: TransactionType.STOCK_SPLIT, ratio: '4:1' }),
    ]

    const splits = extractStockSplits(transactions)

    expect(splits).toHaveLength(2)
    // Should be sorted chronologically (AAPL before NVDA)
    expect(splits[0].symbol).toBe('AAPL')
    expect(splits[0].ratio).toBe('4:1')
    expect(splits[0].ratioMultiplier).toBe(4.0)
    expect(splits[1].symbol).toBe('NVDA')
    expect(splits[1].ratio).toBe('10:1')
    expect(splits[1].ratioMultiplier).toBe(10.0)
  })

  it('should skip invalid ratio formats', () => {
    const transactions = [
      makeTx({ id: 'split-invalid', symbol: 'XYZ', date: '2024-01-01', type: TransactionType.STOCK_SPLIT, ratio: 'invalid' }),
    ]

    expect(extractStockSplits(transactions)).toHaveLength(0)
  })

  it('should skip STOCK_SPLIT transactions without ratio', () => {
    const transactions = [
      makeTx({ id: 'split-no-ratio', symbol: 'XYZ', date: '2024-01-01', type: TransactionType.STOCK_SPLIT, ratio: null }),
    ]

    expect(extractStockSplits(transactions)).toHaveLength(0)
  })

  it('should ignore non-STOCK_SPLIT transactions', () => {
    const transactions = [
      makeTx({ id: 'buy-1', symbol: 'AAPL', type: TransactionType.BUY, quantity: 100, price: 150.0, total: 15000.0, fee: 5.0 }),
    ]

    expect(extractStockSplits(transactions)).toHaveLength(0)
  })

  it('should handle reverse splits correctly', () => {
    const transactions = [
      makeTx({ id: 'split-reverse', symbol: 'XYZ', date: '2024-01-01', type: TransactionType.STOCK_SPLIT, ratio: '1:10' }),
    ]

    const splits = extractStockSplits(transactions)

    expect(splits).toHaveLength(1)
    expect(splits[0].ratioMultiplier).toBe(0.1)
  })
})

describe('SplitEnricher', () => {
  it('should not adjust transactions when no splits exist', async () => {
    const transactions = [
      makeTx({ id: 'buy-1', symbol: 'AAPL', quantity: 100, price: 150.0, total: 15000.0, fee: 5.0 }),
    ]

    const normalized = await enrich(transactions)

    expect(normalized).toHaveLength(1)
    expect(normalized[0].split_adjusted_quantity).toBe(100)
    expect(normalized[0].split_adjusted_price).toBe(150.0)
    expect(normalized[0].split_multiplier).toBe(1.0)
    expect(normalized[0].applied_splits).toEqual([])
  })

  it('should adjust transaction that occurred before a split', async () => {
    const transactions = [
      makeTx({ id: 'buy-1', symbol: 'NVDA', date: '2024-01-15', quantity: 100, price: 500.0, total: 50000.0, fee: 10.0 }),
      makeTx({ id: 'split-1', symbol: 'NVDA', date: '2024-06-10', type: TransactionType.STOCK_SPLIT, ratio: '10:1' }),
    ]

    const normalized = await enrich(transactions)
    const buy = normalized.find(tx => tx.id === 'buy-1')!

    expect(buy.split_adjusted_quantity).toBe(1000) // 100 * 10
    expect(buy.split_adjusted_price).toBe(50.0) // 500 / 10
    expect(buy.split_multiplier).toBe(10.0)
    expect(buy.applied_splits).toEqual(['split-1'])
  })

  it('should not adjust transaction that occurred after a split', async () => {
    const transactions = [
      makeTx({ id: 'split-1', symbol: 'NVDA', date: '2024-06-10', type: TransactionType.STOCK_SPLIT, ratio: '10:1' }),
      makeTx({ id: 'buy-1', symbol: 'NVDA', date: '2024-08-15', quantity: 100, price: 50.0, total: 5000.0, fee: 2.0 }),
    ]

    const normalized = await enrich(transactions)
    const buy = normalized.find(tx => tx.id === 'buy-1')!

    expect(buy.split_adjusted_quantity).toBe(100)
    expect(buy.split_adjusted_price).toBe(50.0)
    expect(buy.split_multiplier).toBe(1.0)
    expect(buy.applied_splits).toEqual([])
  })

  it('should apply multiple splits cumulatively', async () => {
    const transactions = [
      makeTx({ id: 'buy-1', symbol: 'AAPL', date: '2010-01-01', quantity: 100, price: 200.0, total: 20000.0, fee: 10.0 }),
      makeTx({ id: 'split-1', symbol: 'AAPL', date: '2014-06-09', type: TransactionType.STOCK_SPLIT, ratio: '7:1' }),
      makeTx({ id: 'split-2', symbol: 'AAPL', date: '2020-08-31', type: TransactionType.STOCK_SPLIT, ratio: '4:1' }),
    ]

    const normalized = await enrich(transactions)
    const buy = normalized.find(tx => tx.id === 'buy-1')!

    // Should multiply by 7 * 4 = 28
    expect(buy.split_adjusted_quantity).toBe(2800) // 100 * 28
    expect(buy.split_adjusted_price).toBeCloseTo(7.142857, 5) // 200 / 28
    expect(buy.split_multiplier).toBe(28.0)
    expect(buy.applied_splits).toEqual(['split-1', 'split-2'])
  })

  it('should only apply splits for matching symbol', async () => {
    const transactions = [
      makeTx({ id: 'buy-aapl', symbol: 'AAPL', date: '2024-01-15', quantity: 100, price: 150.0, total: 15000.0, fee: 5.0 }),
      makeTx({ id: 'buy-nvda', symbol: 'NVDA', date: '2024-01-15', quantity: 100, price: 500.0, total: 50000.0, fee: 10.0 }),
      makeTx({ id: 'split-nvda', symbol: 'NVDA', date: '2024-06-10', type: TransactionType.STOCK_SPLIT, ratio: '10:1' }),
    ]

    const normalized = await enrich(transactions)

    // AAPL should not be affected
    const aaplBuy = normalized.find(tx => tx.id === 'buy-aapl')!
    expect(aaplBuy.split_adjusted_quantity).toBe(100)
    expect(aaplBuy.split_adjusted_price).toBe(150.0)
    expect(aaplBuy.split_multiplier).toBe(1.0)
    expect(aaplBuy.applied_splits).toEqual([])

    // NVDA should be adjusted
    const nvdaBuy = normalized.find(tx => tx.id === 'buy-nvda')!
    expect(nvdaBuy.split_adjusted_quantity).toBe(1000)
    expect(nvdaBuy.split_adjusted_price).toBe(50.0)
    expect(nvdaBuy.split_multiplier).toBe(10.0)
    expect(nvdaBuy.applied_splits).toEqual(['split-nvda'])
  })

  it('should not adjust non-BUY/SELL transactions', async () => {
    const transactions = [
      makeTx({ id: 'div-1', symbol: 'NVDA', date: '2024-01-15', type: TransactionType.DIVIDEND, total: 100.0, fee: 0 }),
      makeTx({ id: 'split-1', symbol: 'NVDA', date: '2024-06-10', type: TransactionType.STOCK_SPLIT, ratio: '10:1' }),
    ]

    const normalized = await enrich(transactions)

    // DIVIDEND should not be adjusted
    const div = normalized.find(tx => tx.id === 'div-1')!
    expect(div.split_adjusted_quantity).toBeNull()
    expect(div.split_adjusted_price).toBeNull()
    expect(div.split_multiplier).toBe(1.0)
    expect(div.applied_splits).toEqual([])
  })

  it('should handle STOCK_SPLIT transactions themselves', async () => {
    const transactions = [
      makeTx({ id: 'split-1', symbol: 'NVDA', date: '2024-06-10', type: TransactionType.STOCK_SPLIT, ratio: '10:1' }),
    ]

    const normalized = await enrich(transactions)
    const split = normalized[0]

    expect(split.split_adjusted_quantity).toBeNull()
    expect(split.split_adjusted_price).toBeNull()
    expect(split.split_multiplier).toBe(1.0)
    expect(split.applied_splits).toEqual([])
  })

  it('should handle reverse splits correctly', async () => {
    const transactions = [
      makeTx({ id: 'buy-1', symbol: 'XYZ', date: '2024-01-15', quantity: 1000, price: 5.0, total: 5000.0, fee: 5.0 }),
      makeTx({ id: 'split-reverse', symbol: 'XYZ', date: '2024-06-10', type: TransactionType.STOCK_SPLIT, ratio: '1:10' }),
    ]

    const normalized = await enrich(transactions)
    const buy = normalized.find(tx => tx.id === 'buy-1')!

    // Reverse split: multiply by 0.1
    expect(buy.split_adjusted_quantity).toBe(100) // 1000 * 0.1
    expect(buy.split_adjusted_price).toBe(50.0) // 5.00 / 0.1
    expect(buy.split_multiplier).toBe(0.1)
    expect(buy.applied_splits).toEqual(['split-reverse'])
  })
})
