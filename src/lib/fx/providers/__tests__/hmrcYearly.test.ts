import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GOV_UK_DECEMBER_ATTRIBUTION, HMRCYearlyProvider } from '../hmrcYearly'
import bundledYearly from '../../data/hmrcYearly.json'
import { createMemoryCacheBackends, getFxRateCache, setCacheBackends } from '../../../cache'

const years = Object.entries(bundledYearly.years) as [string, { file: string; rates: Record<string, number> }][]
const finalYear = years.find(([, y]) => y.file === 'December')!
// The current year, until its December file is published and bundled
const provisionalYear = years.find(([, y]) => y.file === 'March')

describe('HMRCYearlyProvider with bundled rates', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setCacheBackends(createMemoryCacheBackends())
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', { status: 404 }))
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('bundles every year from 2020, with both CSV formats read', () => {
    expect(years.map(([y]) => y)[0]).toBe('2020')
    for (const [, { rates }] of years) {
      // Before 2023 the files have no codes, so only mapped countries are read
      expect(Object.keys(rates).length).toBeGreaterThanOrEqual(30)
      expect(rates.USD).toBeGreaterThan(1)
    }
  })

  it('reads a year with a December file from the bundle, with no network request', async () => {
    const [year, { rates }] = finalYear

    const result = await new HMRCYearlyProvider().getRate(`${year}-07-01`, 'USD')

    expect(result.rate).toBe(rates.USD)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('prefers a final bundled year to a cached rate', async () => {
    const [year, { rates }] = finalYear
    await getFxRateCache().put({
      id: `HMRC_YEARLY_AVG-${year}-USD`, date: year, currency: 'USD', rate: 9.99,
      source: 'HMRC Annual Average Rates', fxSource: 'HMRC_YEARLY_AVG',
    })

    expect((await new HMRCYearlyProvider().getRate(`${year}-07-01`, 'USD')).rate).toBe(rates.USD)
  })

  it.skipIf(!provisionalYear)('checks gov.uk for December, then falls back to the bundled March file', async () => {
    const [year, { rates }] = provisionalYear!

    const result = await new HMRCYearlyProvider().getRate(`${year}-02-01`, 'USD')

    expect(result.rate).toBe(rates.USD)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toContain(`average_csv_${year}-12.csv`)
  })

  describe('a year whose December file is not bundled', () => {
    const YEAR = '2099'
    const cacheMarchRate = () => getFxRateCache().put({
      id: `HMRC_YEARLY_AVG-${YEAR}-USD`, date: YEAR, currency: 'USD', rate: 1.11,
      source: 'HMRC Annual Average Rates', fxSource: 'HMRC_YEARLY_AVG',
    })
    const decemberCsv = [
      'Country,Unit Of Currency,Currency Code,Sterling value of Currency Unit £,Currency Units per £1',
      'USA,Dollar,USD,0.8000,1.2500',
    ].join('\n')

    afterEach(() => {
      vi.useRealTimers()
    })

    it('uses a cached rate before December can be published', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(`${YEAR}-12-30T12:00:00`))
      await cacheMarchRate()

      expect((await new HMRCYearlyProvider().getRate(`${YEAR}-07-01`, 'USD')).rate).toBe(1.11)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('checks gov.uk for December once it can be out, instead of a cached March rate', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(`${YEAR}-12-31T12:00:00`))
      await cacheMarchRate()
      fetchSpy.mockImplementation(async () => new Response(decemberCsv, { status: 200 }))

      expect((await new HMRCYearlyProvider().getRate(`${YEAR}-07-01`, 'USD')).rate).toBe(1.25)
      expect(String(fetchSpy.mock.calls[0][0])).toContain(`average_csv_${YEAR}-12.csv`)
    })

    it('caches a December rate as final, and never asks gov.uk again', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(`${Number(YEAR) + 1}-01-02T12:00:00`))
      fetchSpy.mockImplementation(async () => new Response(decemberCsv, { status: 200 }))
      await new HMRCYearlyProvider().getRate(`${YEAR}-07-01`, 'USD')

      expect((await getFxRateCache().get(`HMRC_YEARLY_AVG-${YEAR}-USD`))?.source).toBe(GOV_UK_DECEMBER_ATTRIBUTION)

      // A later session, with gov.uk rate-limiting
      fetchSpy.mockClear()
      fetchSpy.mockImplementation(async () => new Response('', { status: 429 }))
      const result = await new HMRCYearlyProvider().getRate(`${YEAR}-07-01`, 'USD')
      expect(result.rate).toBe(1.25)
      expect(result.source).toBe(GOV_UK_DECEMBER_ATTRIBUTION)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('keeps the cached rate when gov.uk has no December file yet', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(`${Number(YEAR) + 1}-01-02T12:00:00`))
      await cacheMarchRate()

      expect((await new HMRCYearlyProvider().getRate(`${YEAR}-07-01`, 'USD')).rate).toBe(1.11)
    })
  })

  it.skipIf(!provisionalYear)('does not cache the bundled March stand-in', async () => {
    const [year] = provisionalYear!

    await new HMRCYearlyProvider().getRate(`${year}-02-01`, 'USD')

    expect(await getFxRateCache().get(`HMRC_YEARLY_AVG-${year}-USD`)).toBeUndefined()
  })
})
