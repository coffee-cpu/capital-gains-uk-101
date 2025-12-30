import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  PoolBreakdownResult,
  CurrentHoldingsResult,
  CurrentHoldingPoint,
  generateSymbolColors,
  formatCurrency,
  getTaxYearBoundaries,
  formatDateLabel,
} from '../../lib/chartData'
import { EmptyState } from './EmptyState'

interface PoolBreakdownChartProps {
  data: PoolBreakdownResult
  holdingsData: CurrentHoldingsResult
}

// Pie chart data type with index signature for Recharts compatibility
type PieDataPoint = CurrentHoldingPoint & { [key: string]: string | number }

interface TimelineTooltipProps {
  active?: boolean
  payload?: Array<{
    dataKey: string
    value: number
    color: string
    payload: { dateLabel: string }
  }>
}

function TimelineTooltip({ active, payload }: TimelineTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const sorted = [...payload]
    .filter(entry => entry.value > 0)
    .sort((a, b) => (b.value as number) - (a.value as number))

  if (sorted.length === 0) return null

  const dateLabel = payload[0]?.payload?.dateLabel

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm max-h-64 overflow-y-auto">
      <p className="font-semibold text-gray-900 mb-2">{dateLabel}</p>
      <div className="space-y-1">
        {sorted.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.dataKey}</span>
            </div>
            <span className="font-medium text-gray-900">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface PieTooltipProps {
  active?: boolean
  payload?: Array<{
    payload: {
      symbol: string
      quantity: number
      valueGbp: number
      averageCostGbp: number
      percentage: number
    }
  }>
}

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-2">{data.symbol}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Quantity:</span>
          <span className="text-gray-900">{data.quantity.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Cost Basis:</span>
          <span className="text-gray-900">{formatCurrency(data.valueGbp)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Avg Cost:</span>
          <span className="text-gray-900">£{data.averageCostGbp.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-100">
          <span className="text-gray-500">Portfolio:</span>
          <span className="font-medium text-gray-900">{data.percentage.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}

export function PoolBreakdownChart({ data, holdingsData }: PoolBreakdownChartProps) {
  if (!data || data.data.length === 0 || data.symbols.length === 0) {
    return <EmptyState message="No Section 104 pools to display" />
  }

  const { data: chartData, symbols } = data
  const colors = generateSymbolColors(symbols)

  // Limit to top 8 symbols for readability
  const displaySymbols = symbols.slice(0, 8)

  // Add timestamp to chart data for numerical x-axis
  const chartDataWithTimestamp = useMemo(() => {
    return chartData.map(point => ({
      ...point,
      timestamp: new Date(point.date).getTime(),
    }))
  }, [chartData])

  // Calculate tax year boundaries with timestamps
  const taxYearBoundaries = useMemo(() => {
    if (chartData.length < 2) return []
    const startDate = chartData[0].date
    const endDate = chartData[chartData.length - 1].date
    return getTaxYearBoundaries(startDate, endDate).map(b => ({
      ...b,
      timestamp: new Date(b.date).getTime(),
    }))
  }, [chartData])

  // Format timestamp for x-axis tick
  const formatXAxis = (timestamp: number) => {
    return formatDateLabel(new Date(timestamp).toISOString().split('T')[0])
  }

  // Prepare pie chart data
  const hasHoldings = holdingsData && holdingsData.holdings.length > 0
  const pieData = hasHoldings ? (holdingsData.holdings as PieDataPoint[]) : []

  // Custom label renderer for pie - positioned outside with connector lines
  const RADIAN = Math.PI / 180
  const renderPieLabel = (props: {
    name?: string
    percent?: number
    cx?: number
    cy?: number
    midAngle?: number
    outerRadius?: number
  }) => {
    const percent = (props.percent ?? 0) * 100
    const { cx = 0, cy = 0, midAngle = 0, outerRadius = 0 } = props

    // Hide label for small segments
    if (percent <= 6) {
      return <text x={0} y={0} visibility="hidden" />
    }

    const radius = outerRadius + 25
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="#374151"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={11}
        fontWeight={500}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {props.name}
      </text>
    )
  }

  // Custom label line (connector) renderer
  const renderLabelLine = (props: {
    percent?: number
    cx?: number
    cy?: number
    midAngle?: number
    outerRadius?: number
    stroke?: string
  }) => {
    const percent = (props.percent ?? 0) * 100
    const { cx = 0, cy = 0, midAngle = 0, outerRadius = 0, stroke } = props

    // Hide line for small segments
    if (percent <= 6) {
      return <path d="" stroke="none" fill="none" />
    }

    // Start point (on pie edge)
    const startX = cx + outerRadius * Math.cos(-midAngle * RADIAN)
    const startY = cy + outerRadius * Math.sin(-midAngle * RADIAN)

    // End point (near label)
    const endRadius = outerRadius + 20
    const endX = cx + endRadius * Math.cos(-midAngle * RADIAN)
    const endY = cy + endRadius * Math.sin(-midAngle * RADIAN)

    return (
      <path
        d={`M ${startX},${startY} L ${endX},${endY}`}
        stroke={stroke}
        strokeWidth={1}
        fill="none"
      />
    )
  }

  return (
    <div className="flex gap-6">
      {/* Timeline Chart (70%) */}
      <div className="flex-[7] min-w-0">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={chartDataWithTimestamp}
            margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatXAxis}
              tick={{ fontSize: 11, fill: '#6B7280' }}
              tickLine={{ stroke: '#E5E7EB' }}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6B7280' }}
              tickLine={{ stroke: '#E5E7EB' }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<TimelineTooltip />} />

            {/* Tax year boundary lines */}
            {taxYearBoundaries.map((boundary) => (
              <ReferenceLine
                key={boundary.date}
                x={boundary.timestamp}
                stroke="#6366F1"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: boundary.label,
                  position: 'top',
                  fill: '#6366F1',
                  fontSize: 11,
                  fontWeight: 500,
                }}
              />
            ))}

            {displaySymbols.map((symbol) => (
              <Area
                key={symbol}
                type="monotone"
                dataKey={symbol}
                stackId="1"
                stroke={colors[symbol]}
                fill={colors[symbol]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Current Holdings Pie (30%) */}
      <div className="flex-[3] border-l border-gray-200 pl-6 flex flex-col">
        <div className="text-center mb-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Current Holdings</p>
          <p className="text-2xl font-bold text-gray-900">
            {hasHoldings ? formatCurrency(holdingsData.totalValueGbp) : '£0'}
          </p>
          {holdingsData.lastTransactionDate && (
            <p className="text-xs text-gray-400">
              as of {formatDateLabel(holdingsData.lastTransactionDate)}
            </p>
          )}
        </div>

        {hasHoldings ? (
          <>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height={170}>
                <PieChart margin={{ top: 5, right: 40, bottom: 5, left: 40 }}>
                  <Pie
                    data={pieData}
                    dataKey="valueGbp"
                    nameKey="symbol"
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={55}
                    paddingAngle={2}
                    label={renderPieLabel}
                    labelLine={renderLabelLine}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs mt-2">
              {holdingsData.holdings.slice(0, 6).map((holding, index) => (
                <div key={index} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-sm"
                    style={{ backgroundColor: holding.color }}
                  />
                  <span className="text-gray-600">{holding.symbol}</span>
                  <span className="text-gray-400">({holding.percentage.toFixed(0)}%)</span>
                </div>
              ))}
              {holdingsData.holdings.length > 6 && (
                <span className="text-gray-400">+{holdingsData.holdings.length - 6} more</span>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            No current holdings
          </div>
        )}
      </div>
    </div>
  )
}
