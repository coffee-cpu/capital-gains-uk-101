/**
 * Data transformation utilities for dashboard charts
 *
 * These functions transform CGT calculation results into chart-ready formats
 * for use with Recharts components.
 */

import { DisposalRecord, Section104Pool } from '../types/cgt'

// Chart color constants (matching tailwind.config.js CGT colors)
export const CHART_COLORS = {
  sameDay: '#4A90E2',      // cgt-same-day (blue)
  thirtyDay: '#F5A623',    // cgt-30-day (orange)
  section104: '#7ED321',   // cgt-section-104 (green)
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
  rule: 'SAME_DAY' | '30_DAY' | 'SECTION_104' | 'MIXED'
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
  quantity: number        // Total shares
  txCount: number         // Number of transactions aggregated
  priceGbp: number
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
  const disposalGains = new Map<string, { gain: number; isGain: boolean }>()
  disposals.forEach(d => {
    disposalGains.set(d.disposal.id, {
      gain: d.gainOrLossGbp,
      isGain: d.gainOrLossGbp >= 0,
    })
  })

  // Filter to only BUY and SELL transactions
  const buysAndSells = transactions.filter(t => t.type === 'BUY' || t.type === 'SELL')

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
  }>()

  sorted.forEach(tx => {
    const key = `${tx.date}-${tx.type}`
    const quantity = tx.split_adjusted_quantity ?? tx.quantity ?? 0
    const price = tx.price_gbp ?? tx.price ?? 0
    const valueGbp = Math.abs(tx.value_gbp ?? (quantity * price))
    const isBuy = tx.type === 'BUY'
    const disposalInfo = !isBuy ? disposalGains.get(tx.id) : undefined

    const existing = dailyData.get(key)
    if (existing) {
      existing.totalValue += valueGbp
      existing.totalQuantity += quantity
      existing.count++
      existing.symbols.add(tx.symbol)
      if (disposalInfo) {
        existing.gainLoss += disposalInfo.gain
      }
    } else {
      dailyData.set(key, {
        date: tx.date,
        type: tx.type as 'BUY' | 'SELL',
        totalValue: valueGbp,
        totalQuantity: quantity,
        gainLoss: disposalInfo?.gain ?? 0,
        count: 1,
        symbols: new Set([tx.symbol]),
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
      quantity: data.totalQuantity,
      txCount: data.count,
      priceGbp: 0,
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
    default:
      return CHART_COLORS.neutral
  }
}
