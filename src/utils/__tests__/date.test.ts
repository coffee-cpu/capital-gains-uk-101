import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { formatIsoDate } from '../date'

describe('formatIsoDate', () => {
  it('writes each style', () => {
    expect(formatIsoDate('2024-04-06', 'chart')).toBe('6 Apr 24')
    expect(formatIsoDate('2024-04-06', 'short')).toBe('6 Apr 2024')
    expect(formatIsoDate('2024-04-06', 'long')).toBe('6 April 2024')
    expect(formatIsoDate('2024-04-06', 'numeric')).toBe('06/04/2024')
  })

  it('uses the date part of a timestamp', () => {
    expect(formatIsoDate('2024-04-06T23:30:00Z', 'short')).toBe('6 Apr 2024')
  })

  describe('west of UTC', () => {
    const originalTz = process.env.TZ
    beforeAll(() => { process.env.TZ = 'America/New_York' })
    afterAll(() => { process.env.TZ = originalTz })

    it('keeps the same day', () => {
      // Local-time formatting would give 5 Apr here
      expect(new Date('2024-04-06').getDate()).toBe(5)
      expect(formatIsoDate('2024-04-06', 'chart')).toBe('6 Apr 24')
      expect(formatIsoDate('2024-01-01', 'numeric')).toBe('01/01/2024')
    })
  })
})
