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
})
