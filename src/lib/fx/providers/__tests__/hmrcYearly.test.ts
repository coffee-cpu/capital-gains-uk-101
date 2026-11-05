import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HMRCYearlyProvider } from '../hmrcYearly'
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
})
