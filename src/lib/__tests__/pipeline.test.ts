import { describe, it, expect } from 'vitest'
import { runPipeline } from '../pipeline'
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
})
