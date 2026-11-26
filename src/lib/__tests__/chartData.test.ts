import { describe, it, expect } from 'vitest'
import {
  buildPoolBreakdownData,
  buildTransactionTimeline,
  formatDateLabel,
  generateSymbolColors,
} from '../chartData'
import { DisposalRecord, Section104Pool } from '../../types/cgt'
import { EnrichedTransaction } from '../../types/transaction'

// Helper to create mock disposal record
function createMockDisposal(overrides: Partial<DisposalRecord> = {}): DisposalRecord {
  const disposal: EnrichedTransaction = {
    id: 'tx-1',
    source: 'Test',
    date: '2024-01-15',
    type: 'SELL',
    symbol: 'AAPL',
    currency: 'GBP',
    quantity: 10,
    price: 100,
    total: 1000,
    fee: 0,
    tax_year: '2023/24',
    ...overrides.disposal,
  } as EnrichedTransaction

  return {
    id: 'disposal-1',
    disposal,
    matchings: [{
      disposal,
      acquisitions: [],
      rule: 'SECTION_104',
      quantityMatched: 10,
      totalCostBasisGbp: 800,
    }],
    proceedsGbp: 1000,
    allowableCostsGbp: 800,
    gainOrLossGbp: 200,
    taxYear: '2023/24',
    isIncomplete: false,
    ...overrides,
  }
}

// Helper to create mock Section 104 pool
function createMockPool(symbol: string, history: Section104Pool['history'] = []): Section104Pool {
  const lastEntry = history[history.length - 1]
  return {
    symbol,
    quantity: lastEntry?.balanceQuantity ?? 0,
    totalCostGbp: lastEntry?.balanceCost ?? 0,
    averageCostGbp: lastEntry ? lastEntry.balanceCost / lastEntry.balanceQuantity : 0,
    history,
  }
}

describe('chartData', () => {
  describe('formatDateLabel', () => {
    it('formats date as day month year', () => {
      expect(formatDateLabel('2024-01-15')).toBe('15 Jan 24')
    })

    it('handles different months', () => {
      expect(formatDateLabel('2023-12-01')).toBe('1 Dec 23')
      expect(formatDateLabel('2024-06-30')).toBe('30 Jun 24')
      // Same day whatever the machine's timezone
      expect(formatDateLabel('2024-04-06T00:00:00Z')).toBe('6 Apr 24')
    })
  })

  describe('generateSymbolColors', () => {
    it('generates distinct colors for symbols', () => {
      const colors = generateSymbolColors(['AAPL', 'MSFT', 'GOOGL'])

      expect(colors).toHaveProperty('AAPL')
      expect(colors).toHaveProperty('MSFT')
      expect(colors).toHaveProperty('GOOGL')

      // All colors should be different
      const colorValues = Object.values(colors)
      const uniqueColors = new Set(colorValues)
      expect(uniqueColors.size).toBe(3)
    })

    it('returns empty object for empty array', () => {
      expect(generateSymbolColors([])).toEqual({})
    })
  })

  describe('buildPoolBreakdownData', () => {
    it('returns empty result for empty pools', () => {
      const result = buildPoolBreakdownData(new Map())
      expect(result).toEqual({ data: [], symbols: [] })
    })

    it('returns empty result for undefined', () => {
      const result = buildPoolBreakdownData(undefined as unknown as Map<string, Section104Pool>)
      expect(result).toEqual({ data: [], symbols: [] })
    })

    it('builds timeline from single pool', () => {
      const pools = new Map([
        ['AAPL', createMockPool('AAPL', [
          { date: '2024-01-01', type: 'BUY', quantity: 10, costOrProceeds: 1000, balanceQuantity: 10, balanceCost: 1000, transactionId: 'tx-1' },
          { date: '2024-02-01', type: 'BUY', quantity: 5, costOrProceeds: 600, balanceQuantity: 15, balanceCost: 1600, transactionId: 'tx-2' },
        ])],
      ])

      const result = buildPoolBreakdownData(pools)

      expect(result.symbols).toEqual(['AAPL'])
      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toMatchObject({
        date: '2024-01-01',
        costs: { AAPL: 1000 },
        quantities: { AAPL: 10 },
      })
      expect(result.data[1]).toMatchObject({
        date: '2024-02-01',
        costs: { AAPL: 1600 },
        quantities: { AAPL: 15 },
      })
    })

    it('forward-fills values for missing dates', () => {
      const pools = new Map([
        ['AAPL', createMockPool('AAPL', [
          { date: '2024-01-01', type: 'BUY', quantity: 10, costOrProceeds: 1000, balanceQuantity: 10, balanceCost: 1000, transactionId: 'tx-1' },
        ])],
        ['MSFT', createMockPool('MSFT', [
          { date: '2024-02-01', type: 'BUY', quantity: 5, costOrProceeds: 500, balanceQuantity: 5, balanceCost: 500, transactionId: 'tx-2' },
        ])],
      ])

      const result = buildPoolBreakdownData(pools)

      expect(result.data).toHaveLength(2)
      // AAPL should be forward-filled to second date
      expect(result.data[1].costs.AAPL).toBe(1000)
      expect(result.data[1].quantities.AAPL).toBe(10)
      // MSFT should be 0 on first date, 500 on second
      expect(result.data[0].costs.MSFT).toBe(0)
      expect(result.data[0].quantities.MSFT).toBe(0)
      expect(result.data[1].costs.MSFT).toBe(500)
      expect(result.data[1].quantities.MSFT).toBe(5)
    })

    it('drops a pool to zero shares and cost once it is sold out', () => {
      const pools = new Map([
        ['AAPL', createMockPool('AAPL', [
          { date: '2024-01-01', type: 'BUY', quantity: 10, costOrProceeds: 1000, balanceQuantity: 10, balanceCost: 1000, transactionId: 'tx-1' },
          { date: '2024-03-01', type: 'SELL', quantity: 10, costOrProceeds: 1200, balanceQuantity: 0, balanceCost: 0, transactionId: 'tx-2' },
        ])],
      ])

      const result = buildPoolBreakdownData(pools)

      expect(result.data[1]).toMatchObject({ costs: { AAPL: 0 }, quantities: { AAPL: 0 } })
    })

    it('keeps a symbol named like a point field apart from the date', () => {
      const pools = new Map([
        ['date', createMockPool('date', [
          { date: '2024-01-01', type: 'BUY', quantity: 2, costOrProceeds: 50, balanceQuantity: 2, balanceCost: 50, transactionId: 'tx-1' },
        ])],
      ])

      const result = buildPoolBreakdownData(pools)

      expect(result.data[0]).toMatchObject({ date: '2024-01-01', costs: { date: 50 }, quantities: { date: 2 } })
    })

    it('sorts symbols by final value descending', () => {
      const pools = new Map([
        ['SMALL', createMockPool('SMALL', [
          { date: '2024-01-01', type: 'BUY', quantity: 1, costOrProceeds: 100, balanceQuantity: 1, balanceCost: 100, transactionId: 'tx-1' },
        ])],
        ['BIG', createMockPool('BIG', [
          { date: '2024-01-01', type: 'BUY', quantity: 100, costOrProceeds: 10000, balanceQuantity: 100, balanceCost: 10000, transactionId: 'tx-2' },
        ])],
      ])

      const result = buildPoolBreakdownData(pools)

      expect(result.symbols[0]).toBe('BIG')
      expect(result.symbols[1]).toBe('SMALL')
    })
  })

  describe('buildTransactionTimeline', () => {
    // Helper to create mock enriched transaction
    function createMockTransaction(overrides: Partial<EnrichedTransaction> = {}): EnrichedTransaction {
      return {
        id: 'tx-1',
        source: 'Test',
        date: '2024-01-15',
        type: 'SELL',
        symbol: 'AAPL',
        currency: 'GBP',
        quantity: 10,
        price: 100,
        total: 1000,
        fee: 0,
        value_gbp: 1000,
        price_gbp: 100,
        tax_year: '2023/24',
        ...overrides,
      } as EnrichedTransaction
    }

    it('returns empty array for empty input', () => {
      expect(buildTransactionTimeline([], [])).toEqual([])
    })

    it('returns empty array for undefined input', () => {
      expect(buildTransactionTimeline(undefined as unknown as EnrichedTransaction[], [])).toEqual([])
    })

    it('transforms single SELL transaction with disposal', () => {
      const transactions = [createMockTransaction({ type: 'SELL' })]
      const disposals = [createMockDisposal({ gainOrLossGbp: 200 })]

      const result = buildTransactionTimeline(transactions, disposals)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'SELL',
        symbol: 'AAPL',
        gainLoss: 200,
        isGain: true,
      })
    })

    it('transforms single BUY transaction', () => {
      const transactions = [createMockTransaction({ id: 'buy-1', type: 'BUY' })]

      const result = buildTransactionTimeline(transactions, [])

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'BUY',
        symbol: 'AAPL',
        gainLoss: undefined,
        isGain: undefined,
      })
    })

    it('passes through isIncomplete for incomplete disposals', () => {
      const transactions = [createMockTransaction({ type: 'SELL' })]
      const disposals = [createMockDisposal({
        gainOrLossGbp: 0,
        isIncomplete: true,
        unmatchedQuantity: 5,
      })]

      const result = buildTransactionTimeline(transactions, disposals)

      expect(result).toHaveLength(1)
      expect(result[0].isIncomplete).toBe(true)
      expect(result[0].unmatchedQuantity).toBe(5)
    })

    it('returns undefined for isIncomplete when disposal is complete', () => {
      const transactions = [createMockTransaction({ type: 'SELL' })]
      const disposals = [createMockDisposal({
        gainOrLossGbp: 200,
        isIncomplete: false,
      })]

      const result = buildTransactionTimeline(transactions, disposals)

      expect(result).toHaveLength(1)
      expect(result[0].isIncomplete).toBeUndefined()
      expect(result[0].unmatchedQuantity).toBeUndefined()
    })

    it('aggregates same-day transactions and ORs incomplete status', () => {
      const transactions = [
        createMockTransaction({ id: 'sell-1', type: 'SELL', date: '2024-01-15', symbol: 'AAPL' }),
        createMockTransaction({ id: 'sell-2', type: 'SELL', date: '2024-01-15', symbol: 'MSFT' }),
      ]
      const disposals = [
        createMockDisposal({
          id: 'disposal-1',
          disposal: { id: 'sell-1' } as EnrichedTransaction,
          gainOrLossGbp: 100,
          isIncomplete: false,
        }),
        createMockDisposal({
          id: 'disposal-2',
          disposal: { id: 'sell-2' } as EnrichedTransaction,
          gainOrLossGbp: 50,
          isIncomplete: true,
          unmatchedQuantity: 3,
        }),
      ]

      const result = buildTransactionTimeline(transactions, disposals)

      // Should aggregate into single bar
      expect(result).toHaveLength(1)
      // Should be marked incomplete because one of them is incomplete
      expect(result[0].isIncomplete).toBe(true)
      expect(result[0].unmatchedQuantity).toBe(3)
      expect(result[0].txCount).toBe(2)
    })

    it('sums unmatched quantities for multiple incomplete disposals on same day', () => {
      const transactions = [
        createMockTransaction({ id: 'sell-1', type: 'SELL', date: '2024-01-15' }),
        createMockTransaction({ id: 'sell-2', type: 'SELL', date: '2024-01-15' }),
      ]
      const disposals = [
        createMockDisposal({
          id: 'disposal-1',
          disposal: { id: 'sell-1' } as EnrichedTransaction,
          isIncomplete: true,
          unmatchedQuantity: 5,
        }),
        createMockDisposal({
          id: 'disposal-2',
          disposal: { id: 'sell-2' } as EnrichedTransaction,
          isIncomplete: true,
          unmatchedQuantity: 3,
        }),
      ]

      const result = buildTransactionTimeline(transactions, disposals)

      expect(result).toHaveLength(1)
      expect(result[0].isIncomplete).toBe(true)
      expect(result[0].unmatchedQuantity).toBe(8) // 5 + 3
    })

    it('does not set isIncomplete for BUY transactions', () => {
      const transactions = [createMockTransaction({ id: 'buy-1', type: 'BUY' })]

      const result = buildTransactionTimeline(transactions, [])

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('BUY')
      expect(result[0].isIncomplete).toBeUndefined()
      expect(result[0].unmatchedQuantity).toBeUndefined()
    })
  })
})
