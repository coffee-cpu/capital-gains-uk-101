import { useMemo } from 'react'
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Brush,
} from 'recharts'
import {
  TransactionTimelinePoint,
  CHART_COLORS,
  formatCurrency,
  getTaxYearBoundaries,
  formatDateLabel,
} from '../../lib/chartData'
import { EmptyState } from './EmptyState'

interface TransactionsChartProps {
  data: TransactionTimelinePoint[]
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    payload: TransactionTimelinePoint & { timestamp: number }
  }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload
  const isBuy = data.type === 'BUY'
  const isAggregated = data.txCount > 1
  const isIncomplete = data.isIncomplete

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      {/* Incomplete Warning Banner */}
      {isIncomplete && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-amber-800">
          <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-medium">Incomplete Data</span>
        </div>
      )}
      <div className="flex items-center gap-2 mb-1">
        <span className={`font-semibold ${isBuy ? 'text-blue-600' : 'text-gray-900'}`}>
          {data.type}
        </span>
        <span className="text-gray-900 font-semibold">{data.symbol}</span>
      </div>
      <p className="text-gray-500 text-xs mb-2">{data.dateLabel}</p>
      <div className="space-y-1 text-xs">
        {isAggregated ? (
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Transactions:</span>
            <span className="text-gray-900">{data.txCount}</span>
          </div>
        ) : (
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Quantity:</span>
            <span className="text-gray-900">{data.quantity.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Value:</span>
          <span className="text-gray-900">{formatCurrency(data.valueGbp)}</span>
        </div>
        {!isBuy && data.gainLoss !== undefined && (
          <div className="flex justify-between gap-4 pt-1 border-t border-gray-100">
            <span className="text-gray-500">{data.isGain ? 'Gain:' : 'Loss:'}</span>
            <span className={data.isGain ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
              {formatCurrency(Math.abs(data.gainLoss))}
              {data.gainLossPercent !== undefined && (
                <span className="ml-1 opacity-75">
                  ({data.gainLossPercent >= 0 ? '+' : ''}{data.gainLossPercent.toFixed(1)}%)
                </span>
              )}
            </span>
          </div>
        )}
        {/* Unmatched quantity details for incomplete disposals */}
        {isIncomplete && data.unmatchedQuantity && (
          <div className="flex justify-between gap-4 pt-1 border-t border-amber-200 text-amber-700">
            <span>Unmatched:</span>
            <span className="font-medium">
              {data.unmatchedQuantity.toLocaleString()} shares
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const BAR_SIZE = 12
const BRUSH_THRESHOLD = 80 // Show brush when more than this many bars

// SVG pattern definitions for striped bars (incomplete disposals)
function StripedPatternDefs() {
  return (
    <svg className="absolute" width="0" height="0">
      <defs>
        {/* Striped pattern for incomplete gains (green with darker stripes) */}
        <pattern
          id="stripe-gain"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="4" height="8" fill={CHART_COLORS.gain} />
          <rect x="4" width="4" height="8" fill="#16A34A" />
        </pattern>

        {/* Striped pattern for incomplete losses (red with darker stripes) */}
        <pattern
          id="stripe-loss"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="4" height="8" fill={CHART_COLORS.loss} />
          <rect x="4" width="4" height="8" fill="#DC2626" />
        </pattern>

        {/* Striped pattern for incomplete neutral (gray with darker stripes) */}
        <pattern
          id="stripe-neutral"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="4" height="8" fill={CHART_COLORS.neutral} />
          <rect x="4" width="4" height="8" fill="#4B5563" />
        </pattern>
      </defs>
    </svg>
  )
}

export function TransactionsChart({ data }: TransactionsChartProps) {
  if (!data || data.length === 0) {
    return <EmptyState message="No transactions to display" />
  }

  // Add timestamp and index for positioning
  const dataWithTimestamp = useMemo(() => {
    return data.map((point, index) => ({
      ...point,
      timestamp: new Date(point.date).getTime(),
      index, // Use index for categorical positioning
    }))
  }, [data])

  // Show brush slider when there are many data points
  const showBrush = data.length > BRUSH_THRESHOLD

  // Calculate tax year boundaries with timestamps
  const taxYearBoundaries = useMemo(() => {
    if (data.length < 2) return []
    const startDate = data[0].date
    const endDate = data[data.length - 1].date

    const boundaries = getTaxYearBoundaries(startDate, endDate)

    // Find the index position for each boundary
    const boundariesWithIndex = boundaries.map(b => {
      const boundaryTime = new Date(b.date).getTime()
      // Find the index where this boundary would fall
      let boundaryIndex = 0
      for (let i = 0; i < dataWithTimestamp.length; i++) {
        if (dataWithTimestamp[i].timestamp >= boundaryTime) {
          // Interpolate between indices
          if (i === 0) {
            boundaryIndex = 0
          } else {
            const prevTime = dataWithTimestamp[i - 1].timestamp
            const currTime = dataWithTimestamp[i].timestamp
            const ratio = (boundaryTime - prevTime) / (currTime - prevTime)
            boundaryIndex = (i - 1) + ratio
          }
          break
        }
        boundaryIndex = i
      }
      return {
        ...b,
        index: boundaryIndex,
      }
    })

    // Filter out boundaries that are too close together (minimum 4 bars apart)
    const minSpacing = 4
    const filtered: typeof boundariesWithIndex = []
    for (const boundary of boundariesWithIndex) {
      const lastBoundary = filtered[filtered.length - 1]
      if (!lastBoundary || (boundary.index - lastBoundary.index) >= minSpacing) {
        filtered.push(boundary)
      }
    }

    return filtered
  }, [data, dataWithTimestamp])

  // Calculate Y axis domain and ticks
  const maxValue = Math.max(...data.map(d => Math.abs(d.barValue)), 1) * 1.1

  // Generate Y-axis ticks excluding extremes (BUY/SELL labels go there)
  const yAxisTicks = useMemo(() => {
    const tickCount = 4 // Number of ticks on each side of zero
    const step = maxValue / (tickCount + 1)
    const ticks: number[] = [0]
    for (let i = 1; i <= tickCount; i++) {
      ticks.push(step * i)
      ticks.push(-step * i)
    }
    return ticks.sort((a, b) => a - b)
  }, [maxValue])

  // Get bar color based on transaction type and gain/loss
  // Returns pattern URL for incomplete disposals
  const getBarColor = (entry: TransactionTimelinePoint) => {
    if (entry.type === 'BUY') {
      return CHART_COLORS.primary // Blue for buys (never incomplete)
    }
    // For sells, check if incomplete and use striped pattern
    const isIncomplete = entry.isIncomplete
    if (entry.isGain === true) {
      return isIncomplete ? 'url(#stripe-gain)' : CHART_COLORS.gain
    }
    if (entry.isGain === false) {
      return isIncomplete ? 'url(#stripe-loss)' : CHART_COLORS.loss
    }
    return isIncomplete ? 'url(#stripe-neutral)' : CHART_COLORS.neutral
  }

  return (
    <div className="relative">
      <StripedPatternDefs />
      <ResponsiveContainer width="100%" height={showBrush ? 340 : 280}>
        <ComposedChart
          data={dataWithTimestamp}
          margin={{ top: 20, right: 50, left: 20, bottom: showBrush ? 5 : 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="index"
            type="number"
            domain={[-0.5, dataWithTimestamp.length - 0.5]}
            tickFormatter={(index) => {
              // Skip first tick to avoid cluttering bottom-left corner with SELL label
              if (Math.round(index) === 0) return ''
              const point = dataWithTimestamp[Math.round(index)]
              return point ? formatDateLabel(point.date) : ''
            }}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            tickLine={{ stroke: '#E5E7EB' }}
            axisLine={{ stroke: '#E5E7EB' }}
            interval={Math.max(0, Math.floor(dataWithTimestamp.length / 8) - 1)}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6B7280' }}
            tickLine={{ stroke: '#E5E7EB' }}
            axisLine={{ stroke: '#E5E7EB' }}
            tickFormatter={(value) => `£${Math.abs(value / 1000).toFixed(0)}k`}
            domain={[-maxValue, maxValue]}
            ticks={yAxisTicks}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Zero line */}
          <ReferenceLine y={0} stroke="#9CA3AF" strokeWidth={1} />

          {/* BUY/SELL axis labels */}
          <ReferenceLine
            y={maxValue}
            stroke="transparent"
            label={{
              value: 'BUY',
              position: 'left',
              fill: CHART_COLORS.primary,
              fontSize: 13,
              fontWeight: 700,
            }}
          />
          <ReferenceLine
            y={-maxValue}
            stroke="transparent"
            label={{
              value: 'SELL',
              position: 'left',
              fill: '#6B7280',
              fontSize: 13,
              fontWeight: 700,
            }}
          />

          {/* Tax year boundary lines */}
          {taxYearBoundaries.map((boundary) => (
            <ReferenceLine
              key={boundary.date}
              x={boundary.index}
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

          <Bar
            dataKey="barValue"
            name="Transaction"
            barSize={BAR_SIZE}
          >
            {dataWithTimestamp.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getBarColor(entry)}
              />
            ))}
          </Bar>

          {/* Brush slider for zooming/panning when many data points */}
          {showBrush && (
            <Brush
              dataKey="index"
              height={30}
              stroke="#9CA3AF"
              fill="#F3F4F6"
              tickFormatter={(index) => {
                const point = dataWithTimestamp[Math.round(index)]
                return point ? formatDateLabel(point.date) : ''
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
