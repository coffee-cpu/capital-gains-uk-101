import { describe, it, expect } from 'vitest'
import { deduplicateTransactions, getIncompleteStockPlanActivity, getImportFileId, findOverlappingImports } from '../deduplication'
import { GenericTransaction } from '../../types/transaction'

// Helper to create a minimal valid transaction
function createTransaction(overrides: Partial<GenericTransaction>): GenericTransaction {
  return {
    id: 'test-1',
    source: 'Charles Schwab',
    symbol: 'AAPL',
    name: 'Apple Inc',
    date: '2024-08-15',
    type: 'BUY',
    quantity: 10,
    price: 150,
    currency: 'USD',
    total: 1500,
    fee: null,
    notes: null,
    ...overrides,
  }
}

describe('deduplicateTransactions', () => {
  describe('incomplete Stock Plan Activity', () => {
    it('should remove incomplete Stock Plan Activity when Equity Awards exists (same day)', () => {
      const transactions: GenericTransaction[] = [
        createTransaction({
          id: 'schwab-1',
          source: 'Charles Schwab',
          date: '2024-08-15',
          incomplete: true,
          notes: 'Stock Plan Activity - ignored',
        }),
        createTransaction({
          id: 'equity-1',
          source: 'Charles Schwab Equity Awards',
          date: '2024-08-15',
        }),
      ]

      const result = deduplicateTransactions(transactions)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('equity-1')
    })

    it('should remove incomplete Stock Plan Activity when Equity Awards is up to 6 days before', () => {
      const transactions: GenericTransaction[] = [
        createTransaction({
          id: 'schwab-1',
          source: 'Charles Schwab',
          date: '2024-08-20', // 5 days after Equity Awards
          incomplete: true,
          notes: 'Stock Plan Activity - ignored',
        }),
        createTransaction({
          id: 'equity-1',
          source: 'Charles Schwab Equity Awards',
          date: '2024-08-15',
        }),
      ]

      const result = deduplicateTransactions(transactions)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('equity-1')
    })

    it('should NOT remove incomplete Stock Plan Activity when Equity Awards is more than 6 days before', () => {
      const transactions: GenericTransaction[] = [
        createTransaction({
          id: 'schwab-1',
          source: 'Charles Schwab',
          date: '2024-08-25', // 10 days after Equity Awards
          incomplete: true,
          notes: 'Stock Plan Activity - ignored',
        }),
        createTransaction({
          id: 'equity-1',
          source: 'Charles Schwab Equity Awards',
          date: '2024-08-15',
        }),
      ]

      const result = deduplicateTransactions(transactions)

      expect(result).toHaveLength(2)
    })

    it('should NOT remove incomplete Stock Plan Activity when Equity Awards is AFTER', () => {
      const transactions: GenericTransaction[] = [
        createTransaction({
          id: 'schwab-1',
          source: 'Charles Schwab',
          date: '2024-08-10', // Before Equity Awards
          incomplete: true,
          notes: 'Stock Plan Activity - ignored',
        }),
        createTransaction({
          id: 'equity-1',
          source: 'Charles Schwab Equity Awards',
          date: '2024-08-15',
        }),
      ]

      const result = deduplicateTransactions(transactions)

      expect(result).toHaveLength(2)
    })
  })

  describe('Stock Plan Activity with price', () => {
    it('should remove Stock Plan Activity WITH price when Equity Awards exists', () => {
      const transactions: GenericTransaction[] = [
        createTransaction({
          id: 'schwab-1',
          source: 'Charles Schwab',
          date: '2024-08-15',
          price: 150, // Has price (manually added)
          incomplete: false,
          notes: 'Stock Plan Activity', // Identified by notes
        }),
        createTransaction({
          id: 'equity-1',
          source: 'Charles Schwab Equity Awards',
          date: '2024-08-15',
        }),
      ]

      const result = deduplicateTransactions(transactions)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('equity-1')
    })

    it('should keep Stock Plan Activity with price when NO Equity Awards exists', () => {
      const transactions: GenericTransaction[] = [
        createTransaction({
          id: 'schwab-1',
          source: 'Charles Schwab',
          date: '2024-08-15',
          price: 150,
          incomplete: false,
          notes: 'Stock Plan Activity',
        }),
      ]

      const result = deduplicateTransactions(transactions)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('schwab-1')
    })
  })

  describe('quantity matching', () => {
    it('should NOT remove Stock Plan Activity when quantities do not match', () => {
      const transactions: GenericTransaction[] = [
        createTransaction({
          id: 'schwab-1',
          source: 'Charles Schwab',
          date: '2024-08-15',
          quantity: 10,
          notes: 'Stock Plan Activity',
        }),
        createTransaction({
          id: 'equity-1',
          source: 'Charles Schwab Equity Awards',
          date: '2024-08-15',
          quantity: 20, // Different quantity
        }),
      ]

      const result = deduplicateTransactions(transactions)

      expect(result).toHaveLength(2)
    })

    it('should remove Stock Plan Activity when quantities match', () => {
      const transactions: GenericTransaction[] = [
        createTransaction({
          id: 'schwab-1',
          source: 'Charles Schwab',
          date: '2024-08-15',
          quantity: 17,
          notes: 'Stock Plan Activity',
        }),
        createTransaction({
          id: 'equity-1',
          source: 'Charles Schwab Equity Awards',
          date: '2024-08-15',
          quantity: 17,
        }),
      ]

      const result = deduplicateTransactions(transactions)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('equity-1')
    })

    it('should remove Stock Plan Activity when one has null quantity', () => {
      const transactions: GenericTransaction[] = [
        createTransaction({
          id: 'schwab-1',
          source: 'Charles Schwab',
          date: '2024-08-15',
          quantity: null, // No quantity
          incomplete: true,
          notes: 'Stock Plan Activity - ignored',
        }),
        createTransaction({
          id: 'equity-1',
          source: 'Charles Schwab Equity Awards',
          date: '2024-08-15',
          quantity: 17,
        }),
      ]

      const result = deduplicateTransactions(transactions)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('equity-1')
    })
  })

  describe('symbol matching', () => {
    it('should NOT remove Stock Plan Activity when symbols do not match', () => {
      const transactions: GenericTransaction[] = [
        createTransaction({
          id: 'schwab-1',
          source: 'Charles Schwab',
          symbol: 'AAPL',
          date: '2024-08-15',
          notes: 'Stock Plan Activity',
        }),
        createTransaction({
          id: 'equity-1',
          source: 'Charles Schwab Equity Awards',
          symbol: 'GOOG', // Different symbol
          date: '2024-08-15',
        }),
      ]

      const result = deduplicateTransactions(transactions)

      expect(result).toHaveLength(2)
    })
  })

  describe('other transactions', () => {
    it('should NOT remove regular Schwab transactions (not Stock Plan Activity)', () => {
      const transactions: GenericTransaction[] = [
        createTransaction({
          id: 'schwab-1',
          source: 'Charles Schwab',
          date: '2024-08-15',
          notes: null, // Not Stock Plan Activity
        }),
        createTransaction({
          id: 'equity-1',
          source: 'Charles Schwab Equity Awards',
          date: '2024-08-15',
        }),
      ]

      const result = deduplicateTransactions(transactions)

      expect(result).toHaveLength(2)
    })

    it('should keep transactions from other brokers', () => {
      const transactions: GenericTransaction[] = [
        createTransaction({
          id: 'trading212-1',
          source: 'Trading 212',
          date: '2024-08-15',
        }),
        createTransaction({
          id: 'equity-1',
          source: 'Charles Schwab Equity Awards',
          date: '2024-08-15',
        }),
      ]

      const result = deduplicateTransactions(transactions)

      expect(result).toHaveLength(2)
    })

    it('should always keep Equity Awards transactions', () => {
      const transactions: GenericTransaction[] = [
        createTransaction({
          id: 'equity-1',
          source: 'Charles Schwab Equity Awards',
          date: '2024-08-15',
        }),
        createTransaction({
          id: 'equity-2',
          source: 'Charles Schwab Equity Awards',
          date: '2024-08-16',
        }),
      ]

      const result = deduplicateTransactions(transactions)

      expect(result).toHaveLength(2)
    })
  })

  describe('multiple transactions', () => {
    it('should handle multiple Stock Plan Activity and Equity Awards correctly', () => {
      const transactions: GenericTransaction[] = [
        // Should be removed - matches equity-1
        createTransaction({
          id: 'schwab-1',
          source: 'Charles Schwab',
          symbol: 'AAPL',
          date: '2024-08-15',
          quantity: 10,
          notes: 'Stock Plan Activity',
        }),
        // Should be kept - no matching Equity Awards
        createTransaction({
          id: 'schwab-2',
          source: 'Charles Schwab',
          symbol: 'GOOG',
          date: '2024-08-15',
          quantity: 5,
          notes: 'Stock Plan Activity',
        }),
        // Should be kept - regular transaction
        createTransaction({
          id: 'schwab-3',
          source: 'Charles Schwab',
          symbol: 'AAPL',
          date: '2024-08-15',
          type: 'SELL',
          quantity: 5,
          notes: null,
        }),
        // Equity Awards - should be kept
        createTransaction({
          id: 'equity-1',
          source: 'Charles Schwab Equity Awards',
          symbol: 'AAPL',
          date: '2024-08-15',
          quantity: 10,
        }),
      ]

      const result = deduplicateTransactions(transactions)

      expect(result).toHaveLength(3)
      expect(result.map(t => t.id).sort()).toEqual(['equity-1', 'schwab-2', 'schwab-3'])
    })
  })
})

describe('getIncompleteStockPlanActivity', () => {
  it('should return symbols for incomplete transactions', () => {
    const transactions: GenericTransaction[] = [
      createTransaction({
        id: '1',
        symbol: 'AAPL',
        incomplete: true,
      }),
      createTransaction({
        id: '2',
        symbol: 'GOOG',
        incomplete: true,
      }),
    ]

    const result = getIncompleteStockPlanActivity(transactions)

    expect(result).toHaveLength(2)
    expect(result).toContain('AAPL')
    expect(result).toContain('GOOG')
  })

  it('should return empty array when no incomplete transactions', () => {
    const transactions: GenericTransaction[] = [
      createTransaction({
        id: '1',
        symbol: 'AAPL',
        incomplete: false,
      }),
      createTransaction({
        id: '2',
        symbol: 'GOOG',
      }),
    ]

    const result = getIncompleteStockPlanActivity(transactions)

    expect(result).toHaveLength(0)
  })

  it('should not include duplicate symbols', () => {
    const transactions: GenericTransaction[] = [
      createTransaction({
        id: '1',
        symbol: 'AAPL',
        incomplete: true,
      }),
      createTransaction({
        id: '2',
        symbol: 'AAPL',
        incomplete: true,
      }),
    ]

    const result = getIncompleteStockPlanActivity(transactions)

    expect(result).toHaveLength(1)
    expect(result).toContain('AAPL')
  })

  it('should skip transactions without symbol', () => {
    const transactions: GenericTransaction[] = [
      createTransaction({
        id: '1',
        symbol: '',
        incomplete: true,
      }),
      createTransaction({
        id: '2',
        symbol: 'AAPL',
        incomplete: true,
      }),
    ]

    const result = getIncompleteStockPlanActivity(transactions)

    expect(result).toHaveLength(1)
    expect(result).toContain('AAPL')
  })
})

describe('overlapping imports', () => {
  // IDs follow the parser pattern `${fileId}-${rowIndex}`, with fileId being
  // `${sanitisedName}-${size}` as created by createFileId
  const trade = (id: string, overrides: Partial<GenericTransaction> = {}) =>
    createTransaction({ id, source: 'Trading 212', notes: null, ...overrides })

  it('reads the file ID from parser-generated transaction IDs', () => {
    expect(getImportFileId('export_2023_csv-5120-14')).toBe('export_2023_csv-5120')
    expect(getImportFileId('ib_csv-900-exp-3')).toBe('ib_csv-900')
    expect(getImportFileId('auto-split-NVDA-2024-06-10')).toBeNull()
    expect(getImportFileId('b1')).toBeNull()
  })

  it('drops rows repeated in a second, overlapping export', () => {
    const year2023 = [trade('y2023_csv-100-1'), trade('y2023_csv-100-2', { date: '2023-09-01' })]
    const fullHistory = [
      trade('all_csv-300-1', { date: '2022-05-01' }),
      trade('all_csv-300-2'),
      trade('all_csv-300-3', { date: '2023-09-01' }),
    ]

    const result = deduplicateTransactions([...year2023, ...fullHistory])

    expect(result).toHaveLength(3)
    expect(result.map(tx => tx.date).sort()).toEqual(['2022-05-01', '2023-09-01', '2024-08-15'])
  })

  it('keeps identical rows within one file (separate fills at the same price)', () => {
    const result = deduplicateTransactions([trade('a_csv-100-1'), trade('a_csv-100-2')])
    expect(result).toHaveLength(2)
  })

  it('keeps the file with the most copies when files overlap', () => {
    const result = deduplicateTransactions([
      trade('a_csv-100-1'),
      trade('b_csv-200-1'),
      trade('b_csv-200-2'),
    ])
    expect(result.map(tx => tx.id)).toEqual(['b_csv-200-1', 'b_csv-200-2'])
  })

  it('keeps matching rows from different brokers', () => {
    const result = deduplicateTransactions([
      trade('a_csv-100-1'),
      trade('b_csv-200-1', { source: 'Freetrade' }),
    ])
    expect(result).toHaveLength(2)
  })

  it('keeps rows that differ in any recorded field', () => {
    const result = deduplicateTransactions([
      trade('a_csv-100-1'),
      trade('b_csv-200-1', { fee: 1 }),
      trade('c_csv-300-1', { quantity: 11 }),
    ])
    expect(result).toHaveLength(3)
  })

  it('never drops rows whose ID does not identify a file', () => {
    const result = deduplicateTransactions([trade('x'), trade('y')])
    expect(result).toHaveLength(2)
  })
})

describe('findOverlappingImports', () => {
  it('returns the removed rows alongside the kept ones', () => {
    const a = createTransaction({ id: 'a_csv-100-1', source: 'Freetrade' })
    const b1 = createTransaction({ id: 'b_csv-200-1', source: 'Freetrade' })
    const b2 = createTransaction({ id: 'b_csv-200-2', source: 'Freetrade' })

    const { kept, removed } = findOverlappingImports([a, b1, b2])

    expect(kept).toEqual([b1, b2])
    expect(removed).toEqual([a])
  })
})
