import { describe, it, expect, afterEach } from 'vitest'
import {
  MemoryRecordCache,
  createMemoryCacheBackends,
  setCacheBackends,
  getFxRateCache,
  CacheBackends,
} from '../cache'
import { BaseFXProvider } from '../fx/providers/base'
import { FXSource } from '../../types/fxSource'

/** Minimal provider that counts fetches, to observe cache hits */
class CountingProvider extends BaseFXProvider {
  readonly fxSource: FXSource = 'HMRC_MONTHLY'
  fetchCount = 0

  getCacheKey(date: string, currency: string): string {
    return `${this.fxSource}-${this.getDateKey(date)}-${currency}`
  }

  protected getDateKey(date: string): string {
    return date.substring(0, 7)
  }

  protected async fetchRate(): Promise<number> {
    this.fetchCount++
    return 1.25
  }
}

describe('MemoryRecordCache', () => {
  it('stores and retrieves records by their key', async () => {
    const cache = new MemoryRecordCache<string, { id: string; value: number }>(r => r.id)

    await cache.put({ id: 'a', value: 1 })
    await cache.bulkPut([{ id: 'b', value: 2 }, { id: 'a', value: 3 }])

    expect(await cache.get('a')).toEqual({ id: 'a', value: 3 })
    expect(await cache.get('b')).toEqual({ id: 'b', value: 2 })
    expect(await cache.get('missing')).toBeUndefined()
  })
})

describe('cache backends', () => {
  afterEach(() => {
    setCacheBackends(createMemoryCacheBackends())
  })

  it('FX providers read and write through the registered FX rate cache', async () => {
    const backends: CacheBackends = createMemoryCacheBackends()
    setCacheBackends(backends)
    const provider = new CountingProvider()

    const first = await provider.getRate('2025-05-14', 'USD')
    const second = await provider.getRate('2025-05-20', 'USD')

    expect(first.rate).toBe(1.25)
    expect(second.rate).toBe(1.25)
    expect(provider.fetchCount).toBe(1)
    expect(await backends.fxRates.get('HMRC_MONTHLY-2025-05-USD')).toMatchObject({
      date: '2025-05',
      currency: 'USD',
      rate: 1.25,
      fxSource: 'HMRC_MONTHLY',
    })
  })

  it('uses rates already present in the registered cache without fetching', async () => {
    const backends = createMemoryCacheBackends()
    await backends.fxRates.put({
      id: 'HMRC_MONTHLY-2024-01-EUR',
      date: '2024-01',
      currency: 'EUR',
      rate: 1.16,
      source: 'test',
    })
    setCacheBackends(backends)
    const provider = new CountingProvider()

    const result = await provider.getRate('2024-01-10', 'EUR')

    expect(result.rate).toBe(1.16)
    expect(provider.fetchCount).toBe(0)
    expect(getFxRateCache()).toBe(backends.fxRates)
  })
})
