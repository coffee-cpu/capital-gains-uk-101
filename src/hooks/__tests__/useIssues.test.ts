import { describe, it, expect } from 'vitest'
import { detectIssues } from '../useIssues'
import type { EnrichedTransaction } from '../../types/transaction'
import type { CGTCalculationResult, TaxYearSummary, DisposalRecord } from '../../types/cgt'

// Helper to create mock enriched transaction
function createMockTransaction(overrides: Partial<EnrichedTransaction> = {}): EnrichedTransaction {
  return {
    id: 'tx-1',
    source: 'Test Broker',
    symbol: 'AAPL',
    name: 'Apple Inc',
    date: '2024-01-15',
    type: 'BUY',
    quantity: 100,
    price: 150,
    currency: 'USD',
    total: 15000,
    fee: 10,
    notes: null,
    fx_rate: 0.79,
    price_gbp: 118.50,
    value_gbp: 11850,
    fee_gbp: 7.90,
    fx_source: 'HMRC Monthly',
    tax_year: '2024/25',
    ...overrides,
  }
}

// Helper to create mock tax year summary
function createMockTaxYearSummary(overrides: Partial<TaxYearSummary> = {}): TaxYearSummary {
  return {
    taxYear: '2024/25',
    startDate: '2024-04-06',
    endDate: '2025-04-05',
    disposals: [],
    totalDisposals: 0,
    totalProceedsGbp: 0,
    totalAllowableCostsGbp: 0,
    totalGainsGbp: 0,
    totalLossesGbp: 0,
    netGainOrLossGbp: 0,
    annualExemptAmount: 3000,
    taxableGainGbp: 0,
    totalDividends: 0,
    totalDividendsGbp: 0,
    grossDividendsGbp: 0,
    totalWithholdingTaxGbp: 0,
    dividendAllowance: 500,
    totalInterest: 0,
    totalInterestGbp: 0,
    grossInterestGbp: 0,
    interestWithholdingTaxGbp: 0,
    incompleteDisposals: 0,
    ...overrides,
  }
}

// Helper to create mock CGT results
function createMockCGTResults(overrides: Partial<CGTCalculationResult> = {}): CGTCalculationResult {
  return {
    transactions: [],
    disposals: [],
    section104Pools: new Map(),
    taxYearSummaries: [createMockTaxYearSummary()],
    metadata: {
      calculatedAt: new Date().toISOString(),
      totalTransactions: 0,
      totalBuys: 0,
      totalSells: 0,
    },
    ...overrides,
  }
}

describe('detectIssues', () => {
  it('returns empty array when no transactions', () => {
    const issues = detectIssues([], null)
    expect(issues).toEqual([])
  })

  it('detects FX rate errors', () => {
    const txWithFxError = createMockTransaction({
      id: 'tx-1',
      symbol: 'AAPL',
      fx_error: 'Failed to fetch rate',
    })

    const issues = detectIssues(
      [txWithFxError],
      createMockCGTResults({
        transactions: [txWithFxError],
        metadata: { calculatedAt: '', totalTransactions: 1, totalBuys: 1, totalSells: 0 },
      })
    )

    const fxIssue = issues.find(i => i.id === 'fx-rate-errors')
    expect(fxIssue).toBeDefined()
    expect(fxIssue?.type).toBe('error')
    expect(fxIssue?.count).toBe(1)
    expect(fxIssue?.affectedItems).toContain('AAPL')
  })

  it('detects crypto FX errors with specific message', () => {
    const txWithCryptoError = createMockTransaction({
      id: 'tx-1',
      symbol: 'BTC',
      fx_error: 'Crypto currency BTC is not supported',
    })

    const issues = detectIssues(
      [txWithCryptoError],
      createMockCGTResults({
        transactions: [txWithCryptoError],
        metadata: { calculatedAt: '', totalTransactions: 1, totalBuys: 1, totalSells: 0 },
      })
    )

    const fxIssue = issues.find(i => i.id === 'fx-rate-errors')
    expect(fxIssue).toBeDefined()
    expect(fxIssue?.description).toContain('Crypto')
    expect(fxIssue?.action).toContain('gbp_value')
  })

  it('detects incomplete Stock Plan Activity with Schwab-specific advice', () => {
    const incompleteTransaction = createMockTransaction({
      id: 'tx-1',
      symbol: 'GOOGL',
      source: 'Charles Schwab',
      incomplete: true,
      ignored: false,
    })

    const issues = detectIssues(
      [incompleteTransaction],
      createMockCGTResults({
        transactions: [incompleteTransaction],
        metadata: { calculatedAt: '', totalTransactions: 1, totalBuys: 1, totalSells: 0 },
      })
    )

    const incompleteIssue = issues.find(i => i.id === 'incomplete-stock-plan')
    expect(incompleteIssue).toBeDefined()
    expect(incompleteIssue?.type).toBe('warning')
    expect(incompleteIssue?.count).toBe(1)
    expect(incompleteIssue?.affectedItems).toContain('GOOGL')
    expect(incompleteIssue?.action).toContain('Equity Awards')
    expect(incompleteIssue?.action).toContain('Supported formats & export guides')
  })

  it('detects incomplete transactions with generic advice for non-Schwab sources', () => {
    const incompleteTransaction = createMockTransaction({
      id: 'tx-1',
      symbol: 'GOOGL',
      source: 'Other Broker',
      incomplete: true,
      ignored: false,
    })

    const issues = detectIssues(
      [incompleteTransaction],
      createMockCGTResults({
        transactions: [incompleteTransaction],
        metadata: { calculatedAt: '', totalTransactions: 1, totalBuys: 1, totalSells: 0 },
      })
    )

    const incompleteIssue = issues.find(i => i.id === 'incomplete-stock-plan')
    expect(incompleteIssue).toBeDefined()
    expect(incompleteIssue?.type).toBe('warning')
    expect(incompleteIssue?.action).not.toContain('Schwab')
    expect(incompleteIssue?.action).toContain('missing price data')
  })

  it('flags incomplete transactions even when ignored', () => {
    // Stock Plan Activity transactions are marked incomplete AND ignored,
    // but we still want to show the warning to prompt the user to upload Equity Awards
    const ignoredTransaction = createMockTransaction({
      id: 'tx-1',
      symbol: 'GOOGL',
      incomplete: true,
      ignored: true,
    })

    const issues = detectIssues(
      [ignoredTransaction],
      createMockCGTResults({
        transactions: [ignoredTransaction],
        metadata: { calculatedAt: '', totalTransactions: 1, totalBuys: 1, totalSells: 0 },
      })
    )

    const incompleteIssue = issues.find(i => i.id === 'incomplete-stock-plan')
    expect(incompleteIssue).toBeDefined()
    expect(incompleteIssue?.type).toBe('warning')
  })

  it('detects incomplete disposals across all tax years', () => {
    const sellTransaction1 = createMockTransaction({
      id: 'tx-1',
      type: 'SELL',
      symbol: 'MSFT',
    })
    const sellTransaction2 = createMockTransaction({
      id: 'tx-2',
      type: 'SELL',
      symbol: 'AAPL',
    })

    const incompleteDisposal1: DisposalRecord = {
      id: 'disposal-1',
      disposal: sellTransaction1,
      matchings: [],
      proceedsGbp: 1000,
      allowableCostsGbp: 0,
      gainOrLossGbp: 1000,
      taxYear: '2023/24', // Different tax year
      unmatchedQuantity: 50,
      isIncomplete: true,
    }
    const incompleteDisposal2: DisposalRecord = {
      id: 'disposal-2',
      disposal: sellTransaction2,
      matchings: [],
      proceedsGbp: 2000,
      allowableCostsGbp: 0,
      gainOrLossGbp: 2000,
      taxYear: '2024/25',
      unmatchedQuantity: 100,
      isIncomplete: true,
    }

    // We should see BOTH incomplete disposals regardless of selected tax year
    const issues = detectIssues(
      [sellTransaction1, sellTransaction2],
      createMockCGTResults({
        transactions: [sellTransaction1, sellTransaction2],
        disposals: [incompleteDisposal1, incompleteDisposal2],
        taxYearSummaries: [
          createMockTaxYearSummary({ taxYear: '2023/24', incompleteDisposals: 1 }),
          createMockTaxYearSummary({ taxYear: '2024/25', incompleteDisposals: 1 }),
        ],
        metadata: { calculatedAt: '', totalTransactions: 2, totalBuys: 0, totalSells: 2 },
      })
    )

    const incompleteDisposalIssue = issues.find(i => i.id === 'incomplete-disposals')
    expect(incompleteDisposalIssue).toBeDefined()
    expect(incompleteDisposalIssue?.type).toBe('error')
    expect(incompleteDisposalIssue?.count).toBe(2) // Both tax years
    expect(incompleteDisposalIssue?.affectedItems).toContain('MSFT')
    expect(incompleteDisposalIssue?.affectedItems).toContain('AAPL')
    // Counted per tax year, since the summary shows one year at a time
    expect(incompleteDisposalIssue?.description).toContain('(2023/24: 1, 2024/25: 1)')
  })

  it('detects buy-only scenario', () => {
    const buyTransaction = createMockTransaction({
      id: 'tx-1',
      type: 'BUY',
      symbol: 'AAPL',
    })

    const issues = detectIssues(
      [buyTransaction],
      createMockCGTResults({
        transactions: [buyTransaction],
        metadata: { calculatedAt: '', totalTransactions: 1, totalBuys: 1, totalSells: 0 },
      })
    )

    const buyOnlyIssue = issues.find(i => i.id === 'buy-only-scenario')
    expect(buyOnlyIssue).toBeDefined()
    expect(buyOnlyIssue?.type).toBe('info')
    expect(buyOnlyIssue?.count).toBe(1)
    expect(buyOnlyIssue?.description).toContain('BUY transaction')
    expect(buyOnlyIssue?.description).toContain('no SELL')
  })

  it('provides Schwab-specific advice for buy-only with Equity Awards', () => {
    const schwabTransaction = createMockTransaction({
      id: 'tx-1',
      type: 'BUY',
      symbol: 'AAPL',
      source: 'Charles Schwab Equity Awards',
    })

    const issues = detectIssues(
      [schwabTransaction],
      createMockCGTResults({
        transactions: [schwabTransaction],
        metadata: { calculatedAt: '', totalTransactions: 1, totalBuys: 1, totalSells: 0 },
      })
    )

    const buyOnlyIssue = issues.find(i => i.id === 'buy-only-scenario')
    expect(buyOnlyIssue).toBeDefined()
    expect(buyOnlyIssue?.action).toContain('Schwab.com')
    expect(buyOnlyIssue?.action).toContain('in addition to Equity Awards')
  })

  it('sorts issues by severity (errors first, then warnings, then info)', () => {
    // Create transactions that trigger all three severity types
    const fxErrorTx = createMockTransaction({
      id: 'tx-1',
      symbol: 'AAPL',
      fx_error: 'Failed to fetch rate',
    })
    const incompleteTx = createMockTransaction({
      id: 'tx-2',
      symbol: 'GOOGL',
      incomplete: true,
      ignored: false,
    })
    const buyTx = createMockTransaction({
      id: 'tx-3',
      type: 'BUY',
      symbol: 'MSFT',
    })

    const issues = detectIssues(
      [fxErrorTx, incompleteTx, buyTx],
      createMockCGTResults({
        transactions: [fxErrorTx, incompleteTx, buyTx],
        metadata: { calculatedAt: '', totalTransactions: 3, totalBuys: 3, totalSells: 0 },
      })
    )

    // Should have: FX error (error), incomplete stock plan (warning), buy-only (info)
    expect(issues.length).toBe(3)
    expect(issues[0].type).toBe('error')
    expect(issues[1].type).toBe('warning')
    expect(issues[2].type).toBe('info')
  })

  it('aggregates multiple affected items', () => {
    const txs = [
      createMockTransaction({ id: 'tx-1', symbol: 'AAPL', fx_error: 'Error' }),
      createMockTransaction({ id: 'tx-2', symbol: 'GOOGL', fx_error: 'Error' }),
      createMockTransaction({ id: 'tx-3', symbol: 'MSFT', fx_error: 'Error' }),
      createMockTransaction({ id: 'tx-4', symbol: 'AAPL', fx_error: 'Error' }), // Duplicate symbol
    ]

    const issues = detectIssues(
      txs,
      createMockCGTResults({
        transactions: txs,
        metadata: { calculatedAt: '', totalTransactions: 4, totalBuys: 4, totalSells: 0 },
      })
    )

    const fxIssue = issues.find(i => i.id === 'fx-rate-errors')
    expect(fxIssue?.count).toBe(4) // All 4 transactions
    // Affected items should be unique symbols
    expect(fxIssue?.affectedItems?.length).toBe(3)
    expect(fxIssue?.affectedItems).toContain('AAPL')
    expect(fxIssue?.affectedItems).toContain('GOOGL')
    expect(fxIssue?.affectedItems).toContain('MSFT')
  })

  it('does not show buy-only issue when there are sells', () => {
    const buyTransaction = createMockTransaction({
      id: 'tx-1',
      type: 'BUY',
      symbol: 'AAPL',
    })
    const sellTransaction = createMockTransaction({
      id: 'tx-2',
      type: 'SELL',
      symbol: 'AAPL',
    })

    const issues = detectIssues(
      [buyTransaction, sellTransaction],
      createMockCGTResults({
        transactions: [buyTransaction, sellTransaction],
        taxYearSummaries: [createMockTaxYearSummary({ totalDisposals: 1 })],
        metadata: { calculatedAt: '', totalTransactions: 2, totalBuys: 1, totalSells: 1 },
      })
    )

    const buyOnlyIssue = issues.find(i => i.id === 'buy-only-scenario')
    expect(buyOnlyIssue).toBeUndefined()
  })
})

describe('detectIssues - data notices', () => {
  it('reports rows dropped as overlapping imports', () => {
    const results = createMockCGTResults({
      dataNotices: {
        overlappingRows: [
          createMockTransaction({ id: 'b_csv-200-1', symbol: 'AAPL' }),
          createMockTransaction({ id: 'b_csv-200-2', symbol: 'MSFT' }),
        ],
        splitConflicts: [],
      },
    })

    const issue = detectIssues([createMockTransaction()], results).find(i => i.id === 'overlapping-imports')!

    expect(issue.type).toBe('warning')
    expect(issue.count).toBe(2)
    expect(issue.affectedItems).toEqual(['AAPL', 'MSFT'])
  })

  it('reports conflicting split records with both ratios', () => {
    const results = createMockCGTResults({
      dataNotices: {
        overlappingRows: [],
        splitConflicts: [{
          symbol: 'NVDA',
          used: { id: 'a', date: '2024-06-10', ratio: '10:1', source: 'Charles Schwab' },
          ignored: { id: 'b', date: '2024-06-12', ratio: '2:1', source: 'Interactive Brokers' },
        }],
      },
    })

    const issue = detectIssues([createMockTransaction()], results).find(i => i.id === 'split-conflicts')!

    expect(issue.type).toBe('warning')
    expect(issue.description).toContain('used 10:1')
    expect(issue.description).toContain('ignored 2:1')
    expect(issue.affectedItems).toEqual(['NVDA'])
  })

  it('reports nothing when there are no data notices', () => {
    const ids = detectIssues([createMockTransaction()], createMockCGTResults()).map(i => i.id)
    expect(ids).not.toContain('overlapping-imports')
    expect(ids).not.toContain('split-conflicts')
  })
})

describe('detectIssues - stock splits without a ratio', () => {
  const issueFor = (autoSplits: boolean) => detectIssues([createMockTransaction()], createMockCGTResults({
    dataNotices: {
      overlappingRows: [],
      splitConflicts: [],
      splitsWithoutRatio: [{ id: 's', symbol: 'AAPL', date: '2024-06-10', source: 'Trading 212' }],
      autoSplits,
    },
  })).find(i => i.id === 'splits-without-ratio')!

  it('warns about split rows that could not be applied', () => {
    const issue = issueFor(true)

    expect(issue.type).toBe('warning')
    expect(issue.description).toContain('AAPL (2024-06-10, Trading 212)')
    expect(issue.affectedItems).toEqual(['AAPL'])
    expect(issue.action).toContain('STOCK_SPLIT row with the ratio')
  })

  it('suggests Community split data only when it is off', () => {
    expect(issueFor(false).action).toContain('Turn on "Community split data"')
    expect(issueFor(true).action).not.toContain('Turn on')
    expect(issueFor(true).action).toContain("Community split data doesn't have this split")
  })
})

describe('detectIssues - rejected split data', () => {
  it('warns about fetched split data that was not applied', () => {
    const results = createMockCGTResults({
      dataNotices: {
        overlappingRows: [],
        splitConflicts: [],
        rejectedSplitRecords: [{ symbol: 'VOD', date: '2023-07-01', reason: 'ratio-out-of-range' }],
      },
    })

    const issue = detectIssues([createMockTransaction()], results).find(i => i.id === 'rejected-split-data')!

    expect(issue.type).toBe('warning')
    expect(issue.description).toContain('VOD (2023-07-01)')
    expect(issue.affectedItems).toEqual(['VOD'])
  })
})


describe('detectIssues - ISIN matching', () => {
  it('reports tickers treated as one security, and tickers naming two', () => {
    const results = createMockCGTResults({
      dataNotices: {
        overlappingRows: [],
        splitConflicts: [],
        symbolMerges: [{ isin: 'IE00B3XXRP09', symbol: 'VUSA', mergedSymbols: ['VUSAL'] }],
        tickerConflicts: [{ symbol: 'BP', isins: ['GB0007980591', 'US0556221044'], pooledSeparately: true }],
      },
    })
    const issues = detectIssues([createMockTransaction()], results)

    const merge = issues.find(i => i.id === 'symbols-matched-by-isin')!
    expect(merge.type).toBe('info')
    expect(merge.description).toContain('VUSAL treated as VUSA (same ISIN IE00B3XXRP09)')

    const conflict = issues.find(i => i.id === 'ticker-isin-conflicts')!
    expect(conflict.type).toBe('warning')
    expect(conflict.description).toContain('BP appears with ISINs GB0007980591 and US0556221044 at the same time')
  })
})
