/**
 * Data transformation utilities for dashboard charts
 *
 * These functions transform CGT calculation results into chart-ready formats
 * for use with Recharts components.
 */

import { DisposalRecord, Section104Pool } from '../types/cgt'
import { isAcquisition, isDisposal } from './cgt/utils'

// Chart color constants (matching tailwind.config.js CGT colors)
export const CHART_COLORS = {
  sameDay: '#4A90E2',      // cgt-same-day (blue)
  thirtyDay: '#F5A623',    // cgt-30-day (orange)
  section104: '#7ED321',   // cgt-section-104 (green)
  shortSell: '#EC4899',    // Short sell (pink - matches Tailwind pink-500)
  gain: '#22C55E',         // Tailwind green-500
  loss: '#EF4444',         // Tailwind red-500
  neutral: '#6B7280',      // Tailwind gray-500
  primary: '#3B82F6',      // Tailwind blue-500
  costBasis: '#9CA3AF',    // Tailwind gray-400
}

// Generate distinct colors for symbols using HSL rotation
export function generateSymbolColors(symbols: string[]): Record<string, string> {
  const colors: Record<string, string> = {}
  const saturation = 65
  const lightness = 55

  symbols.forEach((symbol, index) => {
    const hue = (index * 137.5) % 360 // Golden angle for good distribution
    colors[symbol] = `hsl(${hue}, ${saturation}%, ${lightness}%)`
  })

  return colors
}

/**
 * Format date for chart display
 */
export function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

/**
 * Format date for short display (month + year)
 */
export function formatMonthYear(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

// ============================================================================
// Gains/Losses Chart Data
// ============================================================================

export interface DisposalDataPoint {
  id: string
  date: string
  dateLabel: string
  symbol: string
  gain: number          // Positive for gain, negative for loss
  cumulative: number    // Running total of gains/losses
  rule: 'SAME_DAY' | '30_DAY' | 'SECTION_104' | 'SHORT_SELL' | 'MIXED'
  isGain: boolean
}

/**
 * Transform disposal records into chart data for gains/losses bar chart
 */
export function buildDisposalGainsData(disposals: DisposalRecord[]): DisposalDataPoint[] {
  if (!disposals || disposals.length === 0) {
    return []
  }

  // Sort disposals by date
  const sorted = [...disposals].sort((a, b) =>
    new Date(a.disposal.date).getTime() - new Date(b.disposal.date).getTime()
  )

  let cumulative = 0

  return sorted.map(disposal => {
    cumulative += disposal.gainOrLossGbp

    // Determine primary matching rule
    let rule: DisposalDataPoint['rule'] = 'SECTION_104'
    if (disposal.matchings.length > 0) {
      const rules = new Set(disposal.matchings.map(m => m.rule))
      if (rules.size === 1) {
        rule = disposal.matchings[0].rule as DisposalDataPoint['rule']
      } else {
        rule = 'MIXED'
      }
    }

    return {
      id: disposal.id,
      date: disposal.disposal.date,
      dateLabel: formatDateLabel(disposal.disposal.date),
      symbol: disposal.disposal.symbol,
      gain: disposal.gainOrLossGbp,
      cumulative,
      rule,
      isGain: disposal.gainOrLossGbp >= 0,
    }
  })
}

// ============================================================================
// Transaction Timeline Data (BUYs and SELLs)
// ============================================================================

import { EnrichedTransaction } from '../types/transaction'

export interface TransactionTimelinePoint {
  id: string
  date: string
  dateLabel: string
  symbol: string
  type: 'BUY' | 'SELL'
  valueGbp: number        // Positive value (absolute)
  barValue: number        // Positive for BUY, negative for SELL (for mirrored chart)
  gainLoss?: number       // Only for SELLs - the gain or loss
  isGain?: boolean        // Only for SELLs - true if gain, false if loss
  gainLossPercent?: number // Only for SELLs - percentage gain/loss relative to cost basis
  quantity: number        // Total shares
  txCount: number         // Number of transactions aggregated
  priceGbp: number
  // Incomplete disposal tracking
  isIncomplete?: boolean           // True if any disposal on this day is incomplete
  unmatchedQuantity?: number       // Sum of unmatched quantities for incomplete disposals
}

/**
 * Build transaction timeline data for mirrored bar chart
 * BUYs show as positive bars, SELLs as negative bars
 *
 * Aggregates same-date transactions into single bars per type (BUY/SELL)
 */
export function buildTransactionTimeline(
  transactions: EnrichedTransaction[],
  disposals: DisposalRecord[]
): TransactionTimelinePoint[] {
  if (!transactions || transactions.length === 0) {
    return []
  }

  // Create a map of disposal gains by transaction ID
  const disposalGains = new Map<string, {
    gain: number
    isGain: boolean
    isIncomplete: boolean
    unmatchedQuantity?: number
  }>()
  disposals.forEach(d => {
    disposalGains.set(d.disposal.id, {
      gain: d.gainOrLossGbp,
      isGain: d.gainOrLossGbp >= 0,
      isIncomplete: d.isIncomplete,
      unmatchedQuantity: d.unmatchedQuantity,
    })
  })

  // Filter to only acquisition and disposal transactions (includes options)
  const buysAndSells = transactions.filter(t => isAcquisition(t) || isDisposal(t))

  // Sort by date
  const sorted = [...buysAndSells].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // Aggregate same-date transactions by type (date + BUY/SELL)
  const dailyData = new Map<string, {
    date: string
    type: 'BUY' | 'SELL'
    totalValue: number
    totalQuantity: number
    gainLoss: number
    count: number
    symbols: Set<string>
    hasIncomplete: boolean
    totalUnmatchedQty: number
  }>()

  sorted.forEach(tx => {
    const key = `${tx.date}-${tx.type}`
    const quantity = tx.split_adjusted_quantity ?? tx.quantity ?? 0
    const price = tx.price_gbp ?? tx.price ?? 0
    const valueGbp = Math.abs(tx.value_gbp ?? (quantity * price))
    const isBuy = isAcquisition(tx)
    const disposalInfo = !isBuy ? disposalGains.get(tx.id) : undefined

    const existing = dailyData.get(key)
    if (existing) {
      existing.totalValue += valueGbp
      existing.totalQuantity += quantity
      existing.count++
      existing.symbols.add(tx.symbol)
      if (disposalInfo) {
        existing.gainLoss += disposalInfo.gain
        if (disposalInfo.isIncomplete) {
          existing.hasIncomplete = true
          existing.totalUnmatchedQty += disposalInfo.unmatchedQuantity ?? 0
        }
      }
    } else {
      dailyData.set(key, {
        date: tx.date,
        type: isBuy ? 'BUY' : 'SELL',
        totalValue: valueGbp,
        totalQuantity: quantity,
        gainLoss: disposalInfo?.gain ?? 0,
        count: 1,
        symbols: new Set([tx.symbol]),
        hasIncomplete: disposalInfo?.isIncomplete ?? false,
        totalUnmatchedQty: disposalInfo?.unmatchedQuantity ?? 0,
      })
    }
  })

  // Convert daily aggregates to data points
  const dailyPoints = [...dailyData.values()].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime() ||
    (a.type === 'BUY' ? -1 : 1) // BUYs before SELLs on same date
  )

  return dailyPoints.map(data => {
    const isBuy = data.type === 'BUY'
    const symbolLabel = data.count === 1
      ? [...data.symbols][0]
      : `${data.count} ${isBuy ? 'buys' : 'sells'} (${[...data.symbols].join(', ')})`

    // Calculate percentage gain/loss for SELLs
    // Gain% = (Gain / CostBasis) × 100
    // For short sells where option expires worthless (cost = 0), we can't divide by zero
    // In this case, the entire proceeds are profit, so we show 100% (you kept all your money)
    let gainLossPercent: number | undefined
    if (!isBuy && data.gainLoss !== 0) {
      const costBasis = data.totalValue - data.gainLoss
      if (costBasis > 0) {
        gainLossPercent = (data.gainLoss / costBasis) * 100
      } else if (costBasis === 0 && data.gainLoss > 0) {
        // Zero cost basis with positive gain (e.g., sold option that expired worthless)
        // Show as 100% return since you kept all proceeds with no cost
        gainLossPercent = 100
      }
      // Note: If costBasis is negative (shouldn't happen), leave as undefined
    }

    return {
      id: `${data.date}-${data.type}`,
      date: data.date,
      dateLabel: formatDateLabel(data.date),
      symbol: symbolLabel,
      type: data.type,
      valueGbp: data.totalValue,
      barValue: isBuy ? data.totalValue : -data.totalValue,
      gainLoss: !isBuy && data.gainLoss !== 0 ? data.gainLoss : undefined,
      isGain: !isBuy ? data.gainLoss >= 0 : undefined,
      gainLossPercent,
      quantity: data.totalQuantity,
      txCount: data.count,
      priceGbp: 0,
      isIncomplete: !isBuy && data.hasIncomplete ? true : undefined,
      unmatchedQuantity: !isBuy && data.totalUnmatchedQty > 0 ? data.totalUnmatchedQty : undefined,
    }
  })
}

// ============================================================================
// Section 104 Pool Breakdown Data
// ============================================================================

export interface PoolTimelinePoint {
  date: string
  dateLabel: string
  [symbol: string]: string | number // Dynamic keys for each symbol's cost
}

export interface PoolBreakdownResult {
  data: PoolTimelinePoint[]
  symbols: string[]
}

/**
 * Transform Section 104 pools into stacked area chart data
 */
export function buildPoolBreakdownData(
  pools: Map<string, Section104Pool>
): PoolBreakdownResult {
  if (!pools || pools.size === 0) {
    return { data: [], symbols: [] }
  }

  // Collect all history entries with their symbol
  const allEntries: Array<{
    date: string
    symbol: string
    balanceCost: number
  }> = []

  pools.forEach((pool, symbol) => {
    pool.history.forEach(entry => {
      allEntries.push({
        date: entry.date,
        symbol,
        balanceCost: entry.balanceCost,
      })
    })
  })

  if (allEntries.length === 0) {
    return { data: [], symbols: [] }
  }

  // Get all unique dates, sorted
  const allDates = [...new Set(allEntries.map(e => e.date))].sort()

  // Get all symbols, sorted by final pool value (descending)
  // Filter out empty/invalid symbol names
  const symbolFinalValues: Record<string, number> = {}
  pools.forEach((pool, symbol) => {
    if (symbol && symbol.trim()) {
      symbolFinalValues[symbol] = pool.totalCostGbp
    }
  })
  const symbols = Object.keys(symbolFinalValues).sort(
    (a, b) => symbolFinalValues[b] - symbolFinalValues[a]
  )

  // Build timeline with forward-fill for gaps
  const lastKnownValue: Record<string, number> = {}
  symbols.forEach(s => { lastKnownValue[s] = 0 })

  const data: PoolTimelinePoint[] = allDates.map(date => {
    // Update values for entries on this date
    allEntries
      .filter(e => e.date === date)
      .forEach(e => { lastKnownValue[e.symbol] = e.balanceCost })

    const point: PoolTimelinePoint = {
      date,
      dateLabel: formatDateLabel(date),
    }

    symbols.forEach(symbol => {
      point[symbol] = Math.max(0, lastKnownValue[symbol]) // Ensure non-negative
    })

    return point
  })

  return { data, symbols }
}

// ============================================================================
// Tax Year Utilities
// ============================================================================

/**
 * Get tax year boundaries (April 6th) that fall within a date range
 */
export function getTaxYearBoundaries(
  startDate: string,
  endDate: string
): Array<{ date: string; label: string }> {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const boundaries: Array<{ date: string; label: string }> = []

  // Start from the year of the start date
  let year = start.getFullYear()

  // Check each April 6th from start year to end year + 1
  while (year <= end.getFullYear() + 1) {
    const taxYearStart = new Date(year, 3, 6) // April 6th (month is 0-indexed)

    if (taxYearStart > start && taxYearStart <= end) {
      // Format: "2023/24" for April 6, 2023
      const taxYearLabel = `${year}/${(year + 1).toString().slice(-2)}`
      boundaries.push({
        date: taxYearStart.toISOString().split('T')[0],
        label: taxYearLabel,
      })
    }

    year++
  }

  return boundaries
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format currency for chart tooltips
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format currency with more precision
 */
export function formatCurrencyPrecise(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// ============================================================================
// Current Holdings Pie Chart Data
// ============================================================================

export interface CurrentHoldingPoint {
  symbol: string
  quantity: number
  valueGbp: number
  averageCostGbp: number
  color: string
  percentage: number
}

export interface CurrentHoldingsResult {
  holdings: CurrentHoldingPoint[]
  totalValueGbp: number
  totalQuantity: number
  lastTransactionDate: string | null
}

/**
 * Build current holdings data for pie chart from Section 104 pools
 * Shows holdings as of the last known transaction date
 */
export function buildCurrentHoldingsData(
  pools: Map<string, Section104Pool>
): CurrentHoldingsResult {
  if (!pools || pools.size === 0) {
    return { holdings: [], totalValueGbp: 0, totalQuantity: 0, lastTransactionDate: null }
  }

  // Collect holdings with positive quantities
  const holdings: Array<{
    symbol: string
    quantity: number
    valueGbp: number
    averageCostGbp: number
  }> = []

  let lastDate: string | null = null

  pools.forEach((pool, symbol) => {
    // Track the last transaction date across ALL pools (not just those with holdings)
    if (pool.history.length > 0) {
      const poolLastDate = pool.history[pool.history.length - 1].date
      if (!lastDate || poolLastDate > lastDate) {
        lastDate = poolLastDate
      }
    }

    // Only include pools with positive holdings in the pie chart
    if (symbol && symbol.trim() && pool.quantity > 0) {
      holdings.push({
        symbol,
        quantity: pool.quantity,
        valueGbp: pool.totalCostGbp,
        averageCostGbp: pool.averageCostGbp,
      })
    }
  })

  if (holdings.length === 0) {
    return { holdings: [], totalValueGbp: 0, totalQuantity: 0, lastTransactionDate: lastDate }
  }

  // Sort by value descending
  holdings.sort((a, b) => b.valueGbp - a.valueGbp)

  // Calculate totals
  const totalValueGbp = holdings.reduce((sum, h) => sum + h.valueGbp, 0)
  const totalQuantity = holdings.reduce((sum, h) => sum + h.quantity, 0)

  // Generate colors and percentages
  const colors = generateSymbolColors(holdings.map(h => h.symbol))

  const result: CurrentHoldingPoint[] = holdings.map(h => ({
    ...h,
    color: colors[h.symbol],
    percentage: totalValueGbp > 0 ? (h.valueGbp / totalValueGbp) * 100 : 0,
  }))

  return {
    holdings: result,
    totalValueGbp,
    totalQuantity,
    lastTransactionDate: lastDate,
  }
}

/**
 * Get color for a disposal based on its matching rule
 */
export function getRuleColor(rule: string): string {
  switch (rule) {
    case 'SAME_DAY':
      return CHART_COLORS.sameDay
    case '30_DAY':
      return CHART_COLORS.thirtyDay
    case 'SECTION_104':
      return CHART_COLORS.section104
    case 'SHORT_SELL':
      return CHART_COLORS.shortSell
    default:
      return CHART_COLORS.neutral
  }
}

// ============================================================================
// Trade Statistics
// ============================================================================

export interface BestWorstTrade {
  symbol: string
  date: string
  dateLabel: string
  gainLossPercent: number
  gainLossGbp: number
}

export interface TradeStats {
  totalGainLossGbp: number
  totalGains: number
  totalLosses: number
  sellCount: number
  winCount: number
  lossCount: number
  winRate: number
  avgReturnPercent: number | null
  bestTrade: BestWorstTrade | null
  worstTrade: BestWorstTrade | null
}

/**
 * Calculate trade statistics from transaction timeline data
 */
export function calculateTradeStats(data: TransactionTimelinePoint[]): TradeStats {
  const sells = data.filter(d => d.type === 'SELL' && d.gainLossPercent !== undefined)

  if (sells.length === 0) {
    return {
      totalGainLossGbp: 0,
      totalGains: 0,
      totalLosses: 0,
      sellCount: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      avgReturnPercent: null,
      bestTrade: null,
      worstTrade: null,
    }
  }

  // Calculate totals
  let totalGainLossGbp = 0
  let totalGains = 0
  let totalLosses = 0
  let winCount = 0
  let lossCount = 0
  let totalPercent = 0
  let bestTrade: BestWorstTrade | null = null
  let worstTrade: BestWorstTrade | null = null

  sells.forEach(sell => {
    const gainLoss = sell.gainLoss ?? 0
    totalGainLossGbp += gainLoss

    if (gainLoss >= 0) {
      totalGains += gainLoss
      winCount++
    } else {
      totalLosses += Math.abs(gainLoss)
      lossCount++
    }

    const percent = sell.gainLossPercent ?? 0
    totalPercent += percent

    // Track best and worst trades by percentage
    if (!bestTrade || percent > bestTrade.gainLossPercent) {
      bestTrade = {
        symbol: sell.symbol,
        date: sell.date,
        dateLabel: sell.dateLabel,
        gainLossPercent: percent,
        gainLossGbp: gainLoss,
      }
    }
    if (!worstTrade || percent < worstTrade.gainLossPercent) {
      worstTrade = {
        symbol: sell.symbol,
        date: sell.date,
        dateLabel: sell.dateLabel,
        gainLossPercent: percent,
        gainLossGbp: gainLoss,
      }
    }
  })

  return {
    totalGainLossGbp,
    totalGains,
    totalLosses,
    sellCount: sells.length,
    winCount,
    lossCount,
    winRate: sells.length > 0 ? (winCount / sells.length) * 100 : 0,
    avgReturnPercent: sells.length > 0 ? totalPercent / sells.length : null,
    bestTrade,
    worstTrade,
  }
}
