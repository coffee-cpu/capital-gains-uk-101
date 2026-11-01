// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TradeStatsPanel } from '../TransactionsChart'
import type { BestWorstTrade, TradeStats } from '../../../lib/chartData'

function trade(symbol: string, gainLossPercent: number, gainLossGbp: number): BestWorstTrade {
  return { symbol, date: '2025-05-01', dateLabel: '1 May', gainLossPercent, gainLossGbp }
}

function makeStats(bestTrade: BestWorstTrade, worstTrade: BestWorstTrade): TradeStats {
  return {
    totalGainLossGbp: bestTrade.gainLossGbp + worstTrade.gainLossGbp,
    totalGains: 0,
    totalLosses: 0,
    sellCount: 2,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    avgReturnPercent: null,
    bestTrade,
    worstTrade,
  }
}

const renderPanel = (stats: TradeStats) => renderToStaticMarkup(<TradeStatsPanel stats={stats} />)

describe('TradeStatsPanel', () => {
  it('shows both panels when there is a gain and a loss', () => {
    const html = renderPanel(makeStats(trade('AAPL', 12, 500), trade('MSFT', -4, -120)))
    expect(html).toContain('Best Trade')
    expect(html).toContain('Worst Trade')
  })

  it('hides Best Trade when every trade is a loss', () => {
    const html = renderPanel(makeStats(trade('AAPL', -4, -120), trade('MSFT', -9, -300)))
    expect(html).not.toContain('Best Trade')
    expect(html).toContain('Worst Trade')
  })

  it('hides Worst Trade when every trade is a gain', () => {
    const html = renderPanel(makeStats(trade('AAPL', 12, 500), trade('MSFT', 3, 80)))
    expect(html).toContain('Best Trade')
    expect(html).not.toContain('Worst Trade')
  })
})
