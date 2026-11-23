import { describe, it, expect, vi } from 'vitest'
import { FXManager, createFXProvider } from '../manager'
import type { FXProvider, FXRateResult } from '../../../types/fxSource'

function fakeProvider(getRate: FXProvider['getRate']): FXProvider {
  return {
    fxSource: 'HMRC_MONTHLY',
    getRate,
    getCacheKey: (date, currency) => `HMRC_MONTHLY-${date.slice(0, 7)}-${currency}`,
  }
}

const result = (rate: number): FXRateResult => ({
  rate, dateKey: '2024-06', currency: 'USD', fxSource: 'HMRC_MONTHLY', source: 'test',
})

describe('FXManager', () => {
  it('shares one lookup between dates with the same cache key', async () => {
    const getRate = vi.fn(async () => result(1.25))
    const manager = new FXManager(fakeProvider(getRate))

    const [a, b] = await Promise.all([
      manager.getRate('2024-06-03', 'USD'),
      manager.getRate('2024-06-20', 'USD'),
    ])

    expect(a.rate).toBe(1.25)
    expect(b.rate).toBe(1.25)
    expect(getRate).toHaveBeenCalledTimes(1)
  })

  it('retries a lookup that failed', async () => {
    const getRate = vi.fn<FXProvider['getRate']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(result(1.3))
    const manager = new FXManager(fakeProvider(getRate))

    await expect(manager.getRate('2024-06-03', 'USD')).rejects.toThrow('offline')
    expect((await manager.getRate('2024-06-03', 'USD')).rate).toBe(1.3)
    expect(getRate).toHaveBeenCalledTimes(2)
  })
})

describe('createFXProvider', () => {
  it('builds the provider for each source', () => {
    for (const source of ['HMRC_MONTHLY', 'HMRC_YEARLY_AVG', 'DAILY_SPOT'] as const) {
      expect(createFXProvider(source).fxSource).toBe(source)
    }
  })
})
