import { describe, it, expect, vi, afterEach } from 'vitest'
import { JsDelivrSplitSource } from '../splits/splitDataSource'
import { createMemoryCacheBackends, setCacheBackends } from '../cache'
import { runPipeline, findSplitsWithoutRatio } from '../pipeline'
import type { GenericTransaction } from '../../types/transaction'
import type { SplitDataSource } from '../splits/splitDataSource'
import { importCSVText } from '../import'

describe('runPipeline', () => {
  it('returns null when there are no transactions', async () => {
    expect(await runPipeline([], { autoSplits: false })).toBeNull()
  })

  it('calculates a Section 104 gain from imported GBP transactions without a database', async () => {
    const csv = [
      'date,type,symbol,currency,quantity,price,total,fee',
      '2023-05-01,BUY,VOD,GBP,100,1.00,100,0',
      '2023-06-01,BUY,VOD,GBP,100,2.00,200,0',
      '2023-09-01,SELL,VOD,GBP,100,3.00,300,0',
    ].join('\n')
    const { transactions } = importCSVText(csv, 'gbp')

    const result = await runPipeline(transactions, { autoSplits: false })

    const summary = result!.taxYearSummaries.find(s => s.taxYear === '2023/24')!
    expect(summary.totalDisposals).toBe(1)
    expect(summary.totalProceedsGbp).toBeCloseTo(300)
    // Pool cost: 300 for 200 shares → 150 allowable cost for 100 shares
    expect(summary.totalAllowableCostsGbp).toBeCloseTo(150)
    expect(summary.netGainOrLossGbp).toBeCloseTo(150)
  })

  it('counts overlapping imports once and reports the dropped rows', async () => {
    const header = 'date,type,symbol,currency,quantity,price,total,fee'
    const buy = '2023-05-01,BUY,VOD,GBP,100,1.00,100,0'
    const sell = '2023-09-01,SELL,VOD,GBP,100,3.00,300,0'
    const year = importCSVText([header, buy].join('\n'), 'year_csv-50').transactions
    const all = importCSVText([header, buy, sell].join('\n'), 'all_csv-90').transactions

    const result = await runPipeline([...year, ...all], { autoSplits: false })

    const summary = result!.taxYearSummaries.find(s => s.taxYear === '2023/24')!
    expect(summary.totalAllowableCostsGbp).toBeCloseTo(100)
    expect(result!.dataNotices!.overlappingRows.map(tx => tx.id)).toEqual(['all_csv-90-1'])
    expect(result!.dataNotices!.splitConflicts).toEqual([])
  })

  it('reports split records that disagree on the ratio', async () => {
    const csv = [
      'date,type,symbol,currency,quantity,price,total,fee,split_ratio',
      '2024-01-10,BUY,NVDA,GBP,1,500,500,0,',
      '2024-06-10,STOCK_SPLIT,NVDA,GBP,,,,,10:1',
      '2024-06-12,STOCK_SPLIT,NVDA,GBP,,,,,2:1',
    ].join('\n')
    const { transactions } = importCSVText(csv, 'splits')

    const result = await runPipeline(transactions, { autoSplits: false })

    const conflicts = result!.dataNotices!.splitConflicts
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].used.ratio).toBe('10:1')
    expect(conflicts[0].ignored.ratio).toBe('2:1')
  })

  describe('rejected split data', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('reports fetched split records that failed validation, for held symbols only', async () => {
      setCacheBackends(createMemoryCacheBackends())
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).endsWith('/2023.json')
        ? new Response(JSON.stringify({
            year: 2023,
            updated: '2023-12-31',
            splits: [
              { symbol: 'VOD', date: '2023-07-01', ratioNew: 5000, ratioOld: 1 },
              { symbol: 'NOTHELD', date: '2023-07-01', ratioNew: 5000, ratioOld: 1 },
            ],
          }))
        : new Response('', { status: 404 }))
      const csv = [
        'date,type,symbol,currency,quantity,price,total,fee',
        '2023-05-01,BUY,VOD,GBP,100,1.00,100,0',
      ].join('\n')

      const result = await runPipeline(importCSVText(csv, 'gbp').transactions, {
        autoSplits: true,
        splitSource: new JsDelivrSplitSource(),
      })

      expect(result!.dataNotices!.rejectedSplitRecords).toEqual([
        { symbol: 'VOD', date: '2023-07-01', reason: 'ratio-out-of-range' },
      ])
    })

    it('still warns when the broker split row has a ratio that cannot be applied', async () => {
      setCacheBackends(createMemoryCacheBackends())
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).endsWith('/2023.json')
        ? new Response(JSON.stringify({
            year: 2023,
            updated: '2023-12-31',
            splits: [{ symbol: 'VOD', date: '2023-07-01', ratioNew: 5000, ratioOld: 1 }],
          }))
        : new Response('', { status: 404 }))
      const csv = [
        'date,type,symbol,currency,quantity,price,total,fee,split_ratio',
        '2023-05-01,BUY,VOD,GBP,100,1.00,100,0,',
        '2023-07-03,STOCK_SPLIT,VOD,GBP,,,,,1-for-5',
      ].join('\n')

      const result = await runPipeline(importCSVText(csv, 'gbp').transactions, {
        autoSplits: true,
        splitSource: new JsDelivrSplitSource(),
      })

      expect(result!.dataNotices!.rejectedSplitRecords!.map(r => r.symbol)).toEqual(['VOD'])
    })

    it('does not warn when the broker file records the split, or the share is not held', async () => {
      setCacheBackends(createMemoryCacheBackends())
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).endsWith('/2023.json')
        ? new Response(JSON.stringify({
            year: 2023,
            updated: '2023-12-31',
            splits: [
              { symbol: 'VOD', date: '2023-07-01', ratioNew: 5000, ratioOld: 1 },
              { symbol: 'DIVONLY', date: '2023-07-01', ratioNew: 5000, ratioOld: 1 },
            ],
          }))
        : new Response('', { status: 404 }))
      const csv = [
        'date,type,symbol,currency,quantity,price,total,fee,split_ratio',
        '2023-05-01,BUY,VOD,GBP,100,1.00,100,0,',
        '2023-07-03,STOCK_SPLIT,VOD,GBP,,,,,2:1',
        '2023-08-01,DIVIDEND,DIVONLY,GBP,,,5,0,',
      ].join('\n')

      const result = await runPipeline(importCSVText(csv, 'gbp').transactions, {
        autoSplits: true,
        splitSource: new JsDelivrSplitSource(),
      })

      expect(result!.dataNotices!.rejectedSplitRecords).toEqual([])
    })
  })

  it('pools the same security bought under different tickers at two brokers', async () => {
    const header = 'date,type,symbol,currency,quantity,price,total,fee,isin'
    const brokerA = importCSVText([header, '2023-05-01,BUY,VUSA,GBP,10,50,500,0,IE00B3XXRP09'].join('\n'), 'a_csv-1').transactions
    const brokerB = importCSVText([header, '2023-09-01,SELL,VUSAL,GBP,10,60,600,0,IE00B3XXRP09'].join('\n'), 'b_csv-2').transactions

    const result = await runPipeline([...brokerA, ...brokerB], { autoSplits: false })

    const [disposal] = result!.disposals
    expect(disposal.isIncomplete).toBe(false)
    expect(disposal.gainOrLossGbp).toBeCloseTo(100)
    expect(result!.dataNotices!.symbolMerges).toEqual([
      { isin: 'IE00B3XXRP09', symbol: 'VUSA', mergedSymbols: ['VUSAL'] },
    ])
  })

  it('still applies a stock split looked up under a ticker that was renamed by ISIN', async () => {
    setCacheBackends(createMemoryCacheBackends())
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).endsWith('/2023.json')
      ? new Response(JSON.stringify({
          year: 2023,
          updated: '2023-12-31',
          splits: [{ symbol: 'VUSAL', date: '2023-07-01', ratioNew: 2, ratioOld: 1 }],
        }))
      : new Response('', { status: 404 }))
    const header = 'date,type,symbol,currency,quantity,price,total,fee,isin'
    const a = importCSVText([header, '2023-05-01,BUY,VUSA,GBP,10,50,500,0,IE00B3XXRP09', '2023-05-02,BUY,VUSA,GBP,10,50,500,0,IE00B3XXRP09'].join('\n'), 'a_csv-1').transactions
    const b = importCSVText([header, '2023-06-01,BUY,VUSAL,GBP,10,50,500,0,IE00B3XXRP09', '2023-09-01,SELL,VUSAL,GBP,60,30,1800,0,IE00B3XXRP09'].join('\n'), 'b_csv-2').transactions

    // VUSA and VUSAL have 2 trades each, so the shorter VUSA wins; the split was published under VUSAL
    const result = await runPipeline([...a, ...b], { autoSplits: true, splitSource: new JsDelivrSplitSource() })

    // 30 shares bought before a 2:1 split become 60, so selling 60 is fully matched
    const [disposal] = result!.disposals
    expect(disposal.disposal.symbol).toBe('VUSA')
    expect(disposal.isIncomplete).toBe(false)
    vi.restoreAllMocks()
  })
})

function tx(id: string, date: string, type: GenericTransaction['type'], extra: Partial<GenericTransaction> = {}): GenericTransaction {
  return {
    id, source: 'Trading 212', symbol: 'AAPL', name: null, date, type, quantity: 10, price: 100,
    currency: 'GBP', total: 1000, fee: null, notes: null, ...extra,
  }
}

describe('findSplitsWithoutRatio', () => {
  const buy = tx('buy', '2024-01-10', 'BUY')
  const noRatio = tx('split', '2024-06-10', 'STOCK_SPLIT', { ratio: null, quantity: null, price: null, total: null })

  it('reports a split row with no ratio that nothing covers', () => {
    expect(findSplitsWithoutRatio([buy, noRatio])).toEqual([
      { id: 'split', symbol: 'AAPL', date: '2024-06-10', source: 'Trading 212' },
    ])
  })

  it('reports a ratio that cannot be parsed', () => {
    expect(findSplitsWithoutRatio([buy, { ...noRatio, ratio: 'two for one' }])).toHaveLength(1)
  })

  it('does not report it when a usable split for the same share is within a week', () => {
    const covering = tx('community', '2024-06-07', 'STOCK_SPLIT', { source: 'Community', ratio: '4:1' })
    expect(findSplitsWithoutRatio([buy, noRatio, covering])).toEqual([])
  })

  it('still reports it when the only usable split is for another share or further away', () => {
    const otherShare = tx('o', '2024-06-10', 'STOCK_SPLIT', { symbol: 'MSFT', ratio: '2:1' })
    const tooFar = tx('f', '2024-06-20', 'STOCK_SPLIT', { ratio: '4:1' })
    expect(findSplitsWithoutRatio([buy, noRatio, otherShare, tooFar]).map(s => s.id)).toEqual(['split'])
  })

  it('does not report a split for a share the user never bought or sold', () => {
    expect(findSplitsWithoutRatio([noRatio])).toEqual([])
  })
})

describe('runPipeline - stock splits without a ratio', () => {
  const rows = [
    tx('buy', '2024-01-10', 'BUY'),
    tx('split', '2024-06-10', 'STOCK_SPLIT', { ratio: null, quantity: null, price: null, total: null }),
    tx('sell', '2024-09-10', 'SELL', { quantity: 40, price: 30, total: 1200 }),
  ]

  it('reports the split when auto-splits is off, and says auto-splits was off', async () => {
    const result = await runPipeline(rows, { autoSplits: false })
    expect(result!.dataNotices!.splitsWithoutRatio!.map(s => s.id)).toEqual(['split'])
    expect(result!.dataNotices!.autoSplits).toBe(false)
  })

  it('does not report it when community split data covers it, and applies that ratio', async () => {
    const source: SplitDataSource = {
      fetchSplitsForYears: async () => [{ symbol: 'AAPL', date: '2024-06-10', ratioFrom: 1, ratioTo: 4 }],
    }
    const result = await runPipeline(rows, { autoSplits: true, splitSource: source })

    expect(result!.dataNotices!.splitsWithoutRatio).toEqual([])
    // 10 shares bought become 40, so the sale of 40 is fully matched
    expect(result!.disposals[0].isIncomplete).toBe(false)
  })
})

