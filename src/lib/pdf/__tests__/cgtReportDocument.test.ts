import { describe, it, expect, afterEach } from 'vitest'
import { formatReportDate } from '../cgtReportDocument'

describe('formatReportDate', () => {
  const originalTZ = process.env.TZ
  afterEach(() => { process.env.TZ = originalTZ })

  it.each(['America/New_York', 'Europe/London', 'Pacific/Auckland'])(
    'prints the same calendar date in %s',
    timeZone => {
      process.env.TZ = timeZone

      expect(formatReportDate('2024-04-06')).toBe('06/04/2024')
      expect(formatReportDate('2025-04-05')).toBe('05/04/2025')
    }
  )
})
