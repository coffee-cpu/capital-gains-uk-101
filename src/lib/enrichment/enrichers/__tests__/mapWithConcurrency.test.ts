import { describe, it, expect } from 'vitest'
import { mapWithConcurrency } from '../fxEnricher'

describe('mapWithConcurrency', () => {
  it('keeps the input order and never exceeds the limit', async () => {
    let running = 0
    let maxRunning = 0
    const delays = [30, 5, 20, 1, 10, 15]

    const results = await mapWithConcurrency(delays, 2, async delay => {
      running++
      maxRunning = Math.max(maxRunning, running)
      await new Promise(resolve => setTimeout(resolve, delay))
      running--
      return delay * 2
    })

    expect(results).toEqual(delays.map(d => d * 2))
    expect(maxRunning).toBe(2)
  })

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 4, async x => x)).toEqual([])
  })
})
