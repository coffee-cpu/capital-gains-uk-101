import { describe, it, expect } from 'vitest'
import {
  buildDisposalGainsData,
  buildPoolBreakdownData,
  formatDateLabel,
  formatMonthYear,
  formatCurrency,
  formatCurrencyPrecise,
  generateSymbolColors,
  getRuleColor,
  CHART_COLORS,
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
    })
  })

  describe('formatMonthYear', () => {
    it('formats date as month year', () => {
      expect(formatMonthYear('2024-01-15')).toBe('Jan 24')
    })
  })

  describe('formatCurrency', () => {
    it('formats positive amounts', () => {
      expect(formatCurrency(1234)).toBe('£1,234')
    })

    it('formats negative amounts', () => {
      expect(formatCurrency(-5000)).toBe('-£5,000')
    })

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('£0')
    })
  })

  describe('formatCurrencyPrecise', () => {
    it('formats with decimal places', () => {
      expect(formatCurrencyPrecise(1234.56)).toBe('£1,234.56')
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

  describe('getRuleColor', () => {
    it('returns correct colors for each rule', () => {
      expect(getRuleColor('SAME_DAY')).toBe(CHART_COLORS.sameDay)
      expect(getRuleColor('30_DAY')).toBe(CHART_COLORS.thirtyDay)
      expect(getRuleColor('SECTION_104')).toBe(CHART_COLORS.section104)
    })

    it('returns neutral for unknown rules', () => {
      expect(getRuleColor('UNKNOWN')).toBe(CHART_COLORS.neutral)
    })
  })

  describe('buildDisposalGainsData', () => {
    it('returns empty array for empty input', () => {
      expect(buildDisposalGainsData([])).toEqual([])
    })

    it('returns empty array for undefined input', () => {
      expect(buildDisposalGainsData(undefined as unknown as DisposalRecord[])).toEqual([])
    })

    it('transforms single disposal correctly', () => {
      const disposal = createMockDisposal({
        gainOrLossGbp: 500,
      })

      const result = buildDisposalGainsData([disposal])

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'disposal-1',
        symbol: 'AAPL',
        gain: 500,
        cumulative: 500,
        isGain: true,
        rule: 'SECTION_104',
      })
    })

    it('calculates cumulative correctly for multiple disposals', () => {
      const disposals = [
        createMockDisposal({
          id: 'disposal-1',
          disposal: { date: '2024-01-10' } as EnrichedTransaction,
          gainOrLossGbp: 100,
        }),
        createMockDisposal({
          id: 'disposal-2',
          disposal: { date: '2024-01-20' } as EnrichedTransaction,
          gainOrLossGbp: -50,
        }),
        createMockDisposal({
          id: 'disposal-3',
          disposal: { date: '2024-01-30' } as EnrichedTransaction,
          gainOrLossGbp: 200,
        }),
      ]

      const result = buildDisposalGainsData(disposals)

      expect(result[0].cumulative).toBe(100)
      expect(result[1].cumulative).toBe(50)  // 100 - 50
      expect(result[2].cumulative).toBe(250) // 50 + 200
    })

    it('sorts disposals by date', () => {
      const disposals = [
        createMockDisposal({
          id: 'disposal-2',
          disposal: { date: '2024-02-01' } as EnrichedTransaction,
        }),
        createMockDisposal({
          id: 'disposal-1',
          disposal: { date: '2024-01-01' } as EnrichedTransaction,
        }),
      ]

      const result = buildDisposalGainsData(disposals)

      expect(result[0].date).toBe('2024-01-01')
      expect(result[1].date).toBe('2024-02-01')
    })

    it('identifies losses correctly', () => {
      const disposal = createMockDisposal({
        gainOrLossGbp: -300,
      })

      const result = buildDisposalGainsData([disposal])

      expect(result[0].isGain).toBe(false)
      expect(result[0].gain).toBe(-300)
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
        AAPL: 1000,
      })
      expect(result.data[1]).toMatchObject({
        date: '2024-02-01',
        AAPL: 1600,
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
      expect(result.data[1].AAPL).toBe(1000)
      // MSFT should be 0 on first date, 500 on second
      expect(result.data[0].MSFT).toBe(0)
      expect(result.data[1].MSFT).toBe(500)
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
})
