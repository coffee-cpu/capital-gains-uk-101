import { describe, it, expect } from 'vitest'
import { extractStockSplits, applySplitNormalization } from '../normalization'
import { GenericTransaction } from '../../../types/transaction'

describe('extractStockSplits', () => {
  it('should extract valid stock split events', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'split-1',
        source: 'Generic CSV',
        symbol: 'NVDA',
        name: 'NVIDIA Corp.',
        date: '2024-06-10',
        type: 'STOCK_SPLIT',
        quantity: null,
        price: null,
        currency: 'USD',
        total: null,
        fee: null,
        notes: null,
        ratio: '10:1',
      },
      {
        id: 'split-2',
        source: 'Generic CSV',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2020-08-31',
        type: 'STOCK_SPLIT',
        quantity: null,
        price: null,
        currency: 'USD',
        total: null,
        fee: null,
        notes: null,
        ratio: '4:1',
      },
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
    const transactions: GenericTransaction[] = [
      {
        id: 'split-invalid',
        source: 'Generic CSV',
        symbol: 'XYZ',
        name: null,
        date: '2024-01-01',
        type: 'STOCK_SPLIT',
        quantity: null,
        price: null,
        currency: 'USD',
        total: null,
        fee: null,
        notes: null,
        ratio: 'invalid',
      },
    ]

    const splits = extractStockSplits(transactions)

    expect(splits).toHaveLength(0)
  })

  it('should skip STOCK_SPLIT transactions without ratio', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'split-no-ratio',
        source: 'Generic CSV',
        symbol: 'XYZ',
        name: null,
        date: '2024-01-01',
        type: 'STOCK_SPLIT',
        quantity: null,
        price: null,
        currency: 'USD',
        total: null,
        fee: null,
        notes: null,
        ratio: null,
      },
    ]

    const splits = extractStockSplits(transactions)

    expect(splits).toHaveLength(0)
  })

  it('should ignore non-STOCK_SPLIT transactions', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'buy-1',
        source: 'Generic CSV',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2024-01-15',
        type: 'BUY',
        quantity: 100,
        price: 150.00,
        currency: 'USD',
        total: 15000.00,
        fee: 5.00,
        notes: null,
        ratio: null,
      },
    ]

    const splits = extractStockSplits(transactions)

    expect(splits).toHaveLength(0)
  })

  it('should handle reverse splits correctly', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'split-reverse',
        source: 'Generic CSV',
        symbol: 'XYZ',
        name: null,
        date: '2024-01-01',
        type: 'STOCK_SPLIT',
        quantity: null,
        price: null,
        currency: 'USD',
        total: null,
        fee: null,
        notes: null,
        ratio: '1:10',
      },
    ]

    const splits = extractStockSplits(transactions)

    expect(splits).toHaveLength(1)
    expect(splits[0].ratioMultiplier).toBe(0.1)
  })
})

describe('applySplitNormalization', () => {
  it('should not adjust transactions when no splits exist', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'buy-1',
        source: 'Generic CSV',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2024-01-15',
        type: 'BUY',
        quantity: 100,
        price: 150.00,
        currency: 'USD',
        total: 15000.00,
        fee: 5.00,
        notes: null,
        ratio: null,
      },
    ]

    const normalized = applySplitNormalization(transactions)

    expect(normalized).toHaveLength(1)
    expect(normalized[0].split_adjusted_quantity).toBe(100)
    expect(normalized[0].split_adjusted_price).toBe(150.00)
    expect(normalized[0].split_multiplier).toBe(1.0)
    expect(normalized[0].applied_splits).toEqual([])
  })

  it('should adjust transaction that occurred before a split', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'buy-1',
        source: 'Generic CSV',
        symbol: 'NVDA',
        name: 'NVIDIA Corp.',
        date: '2024-01-15',
        type: 'BUY',
        quantity: 100,
        price: 500.00,
        currency: 'USD',
        total: 50000.00,
        fee: 10.00,
        notes: null,
        ratio: null,
      },
      {
        id: 'split-1',
        source: 'Generic CSV',
        symbol: 'NVDA',
        name: 'NVIDIA Corp.',
        date: '2024-06-10',
        type: 'STOCK_SPLIT',
        quantity: null,
        price: null,
        currency: 'USD',
        total: null,
        fee: null,
        notes: null,
        ratio: '10:1',
      },
    ]

    const normalized = applySplitNormalization(transactions)

    // Find the BUY transaction
    const buy = normalized.find(tx => tx.id === 'buy-1')!

    expect(buy.split_adjusted_quantity).toBe(1000) // 100 * 10
    expect(buy.split_adjusted_price).toBe(50.00) // 500 / 10
    expect(buy.split_multiplier).toBe(10.0)
    expect(buy.applied_splits).toEqual(['split-1'])
  })

  it('should not adjust transaction that occurred after a split', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'split-1',
        source: 'Generic CSV',
        symbol: 'NVDA',
        name: 'NVIDIA Corp.',
        date: '2024-06-10',
        type: 'STOCK_SPLIT',
        quantity: null,
        price: null,
        currency: 'USD',
        total: null,
        fee: null,
        notes: null,
        ratio: '10:1',
      },
      {
        id: 'buy-1',
        source: 'Generic CSV',
        symbol: 'NVDA',
        name: 'NVIDIA Corp.',
        date: '2024-08-15',
        type: 'BUY',
        quantity: 100,
        price: 50.00,
        currency: 'USD',
        total: 5000.00,
        fee: 2.00,
        notes: null,
        ratio: null,
      },
    ]

    const normalized = applySplitNormalization(transactions)

    // Find the BUY transaction
    const buy = normalized.find(tx => tx.id === 'buy-1')!

    expect(buy.split_adjusted_quantity).toBe(100)
    expect(buy.split_adjusted_price).toBe(50.00)
    expect(buy.split_multiplier).toBe(1.0)
    expect(buy.applied_splits).toEqual([])
  })

  it('should apply multiple splits cumulatively', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'buy-1',
        source: 'Generic CSV',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2010-01-01',
        type: 'BUY',
        quantity: 100,
        price: 200.00,
        currency: 'USD',
        total: 20000.00,
        fee: 10.00,
        notes: null,
        ratio: null,
      },
      {
        id: 'split-1',
        source: 'Generic CSV',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2014-06-09',
        type: 'STOCK_SPLIT',
        quantity: null,
        price: null,
        currency: 'USD',
        total: null,
        fee: null,
        notes: null,
        ratio: '7:1',
      },
      {
        id: 'split-2',
        source: 'Generic CSV',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2020-08-31',
        type: 'STOCK_SPLIT',
        quantity: null,
        price: null,
        currency: 'USD',
        total: null,
        fee: null,
        notes: null,
        ratio: '4:1',
      },
    ]

    const normalized = applySplitNormalization(transactions)

    // Find the BUY transaction
    const buy = normalized.find(tx => tx.id === 'buy-1')!

    // Should multiply by 7 * 4 = 28
    expect(buy.split_adjusted_quantity).toBe(2800) // 100 * 28
    expect(buy.split_adjusted_price).toBeCloseTo(7.142857, 5) // 200 / 28
    expect(buy.split_multiplier).toBe(28.0)
    expect(buy.applied_splits).toEqual(['split-1', 'split-2'])
  })

  it('should only apply splits for matching symbol', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'buy-aapl',
        source: 'Generic CSV',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2024-01-15',
        type: 'BUY',
        quantity: 100,
        price: 150.00,
        currency: 'USD',
        total: 15000.00,
        fee: 5.00,
        notes: null,
        ratio: null,
      },
      {
        id: 'buy-nvda',
        source: 'Generic CSV',
        symbol: 'NVDA',
        name: 'NVIDIA Corp.',
        date: '2024-01-15',
        type: 'BUY',
        quantity: 100,
        price: 500.00,
        currency: 'USD',
        total: 50000.00,
        fee: 10.00,
        notes: null,
        ratio: null,
      },
      {
        id: 'split-nvda',
        source: 'Generic CSV',
        symbol: 'NVDA',
        name: 'NVIDIA Corp.',
        date: '2024-06-10',
        type: 'STOCK_SPLIT',
        quantity: null,
        price: null,
        currency: 'USD',
        total: null,
        fee: null,
        notes: null,
        ratio: '10:1',
      },
    ]

    const normalized = applySplitNormalization(transactions)

    // AAPL should not be affected
    const aaplBuy = normalized.find(tx => tx.id === 'buy-aapl')!
    expect(aaplBuy.split_adjusted_quantity).toBe(100)
    expect(aaplBuy.split_adjusted_price).toBe(150.00)
    expect(aaplBuy.split_multiplier).toBe(1.0)
    expect(aaplBuy.applied_splits).toEqual([])

    // NVDA should be adjusted
    const nvdaBuy = normalized.find(tx => tx.id === 'buy-nvda')!
    expect(nvdaBuy.split_adjusted_quantity).toBe(1000)
    expect(nvdaBuy.split_adjusted_price).toBe(50.00)
    expect(nvdaBuy.split_multiplier).toBe(10.0)
    expect(nvdaBuy.applied_splits).toEqual(['split-nvda'])
  })

  it('should not adjust non-BUY/SELL transactions', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'div-1',
        source: 'Generic CSV',
        symbol: 'NVDA',
        name: 'NVIDIA Corp.',
        date: '2024-01-15',
        type: 'DIVIDEND',
        quantity: null,
        price: null,
        currency: 'USD',
        total: 100.00,
        fee: 0,
        notes: null,
        ratio: null,
      },
      {
        id: 'split-1',
        source: 'Generic CSV',
        symbol: 'NVDA',
        name: 'NVIDIA Corp.',
        date: '2024-06-10',
        type: 'STOCK_SPLIT',
        quantity: null,
        price: null,
        currency: 'USD',
        total: null,
        fee: null,
        notes: null,
        ratio: '10:1',
      },
    ]

    const normalized = applySplitNormalization(transactions)

    // DIVIDEND should not be adjusted
    const div = normalized.find(tx => tx.id === 'div-1')!
    expect(div.split_adjusted_quantity).toBeNull()
    expect(div.split_adjusted_price).toBeNull()
    expect(div.split_multiplier).toBe(1.0)
    expect(div.applied_splits).toEqual([])
  })

  it('should handle STOCK_SPLIT transactions themselves', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'split-1',
        source: 'Generic CSV',
        symbol: 'NVDA',
        name: 'NVIDIA Corp.',
        date: '2024-06-10',
        type: 'STOCK_SPLIT',
        quantity: null,
        price: null,
        currency: 'USD',
        total: null,
        fee: null,
        notes: null,
        ratio: '10:1',
      },
    ]

    const normalized = applySplitNormalization(transactions)

    const split = normalized[0]
    expect(split.split_adjusted_quantity).toBeNull()
    expect(split.split_adjusted_price).toBeNull()
    expect(split.split_multiplier).toBe(1.0)
    expect(split.applied_splits).toEqual([])
  })

  it('should handle reverse splits correctly', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'buy-1',
        source: 'Generic CSV',
        symbol: 'XYZ',
        name: null,
        date: '2024-01-15',
        type: 'BUY',
        quantity: 1000,
        price: 5.00,
        currency: 'USD',
        total: 5000.00,
        fee: 5.00,
        notes: null,
        ratio: null,
      },
      {
        id: 'split-reverse',
        source: 'Generic CSV',
        symbol: 'XYZ',
        name: null,
        date: '2024-06-10',
        type: 'STOCK_SPLIT',
        quantity: null,
        price: null,
        currency: 'USD',
        total: null,
        fee: null,
        notes: null,
        ratio: '1:10',
      },
    ]

    const normalized = applySplitNormalization(transactions)

    const buy = normalized.find(tx => tx.id === 'buy-1')!

    // Reverse split: multiply by 0.1
    expect(buy.split_adjusted_quantity).toBe(100) // 1000 * 0.1
    expect(buy.split_adjusted_price).toBe(50.00) // 5.00 / 0.1
    expect(buy.split_multiplier).toBe(0.1)
    expect(buy.applied_splits).toEqual(['split-reverse'])
  })
})
