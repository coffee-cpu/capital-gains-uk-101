import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import {
  PoolBreakdownResult,
  generateSymbolColors,
  formatCurrency,
  getTaxYearBoundaries,
  formatDateLabel,
} from '../../lib/chartData'
import { EmptyState } from './EmptyState'

interface PoolBreakdownChartProps {
  data: PoolBreakdownResult
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    dataKey: string
    value: number
    color: string
    payload: { dateLabel: string }
  }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  // Sort by value descending, filter out zero values
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

export function PoolBreakdownChart({ data }: PoolBreakdownChartProps) {
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

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={chartDataWithTimestamp}
        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
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
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px' }}
          formatter={(value) => <span className="text-gray-600">{value}</span>}
        />

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
  )
}
