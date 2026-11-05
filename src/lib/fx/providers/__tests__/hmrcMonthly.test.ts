import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  HMRCMonthlyProvider,
  ARCHIVE_ATTRIBUTION,
  GOV_UK_ATTRIBUTION,
  govUkMonthlyCsvUrl,
  isBundledMonth,
  parseGovUkMonthlyCsv,
} from '../hmrcMonthly'
import {
  BUNDLED_MONTHLY_YEARS,
  EXCLUDED_RATES,
  FIRST_BUNDLED_MONTH,
  LAST_BUNDLED_MONTH,
} from '../../data/hmrcMonthly'
import { createMemoryCacheBackends, getFxRateCache, setCacheBackends } from '../../../cache'
import { FXSourceAttributions } from '../../../../types/fxSource'
import { FxEnricher } from '../../../enrichment/enrichers/fxEnricher'
import type { EnrichedTransaction } from '../../../../types/transaction'

/**
 * A gov.uk-style monthly CSV: USD 1.2711, EUR 1.1695 and filler currencies,
 * 160 rates in all like a real file
 */
function govUkCsv(): string {
  const rows = [
    'Country/Territories,Currency,Currency Code,Currency Units per £1,Start date,End date',
    'USA,Dollar,USD,1.2711,01/06/2099,30/06/2099',
    'Eurozone,Euro,EUR,1.1695,01/06/2099,30/06/2099',
    '"Korea, South",Won,KRW,1745.12,01/06/2099,30/06/2099',
  ]
  for (let i = 0; i < 157; i++) {
    const code = 'X' + String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))
    rows.push(`Somewhere ${i},Unit,${code},${(i + 1) * 1.5},01/06/2099,30/06/2099`)
  }
  return rows.join('\n')
}

/** A month after the bundle, so it's read from gov.uk */
const LATER = '2099-06-14'
const LATER_URL = govUkMonthlyCsvUrl('2099', '06')

describe('parseGovUkMonthlyCsv', () => {
  it('reads codes and rates by header, including quoted country names with commas', () => {
    const rates = parseGovUkMonthlyCsv(govUkCsv())
    expect(rates.USD).toBe(1.2711)
    expect(rates.EUR).toBe(1.1695)
    expect(rates.KRW).toBe(1745.12)
  })

  it('rejects an error page or a file with too few rates', () => {
    expect(() => parseGovUkMonthlyCsv('<html>Not found</html>')).toThrow()
    expect(() => parseGovUkMonthlyCsv(govUkCsv().split('\n').slice(0, 4).join('\n'))).toThrow(/only 3 rates/)
  })

  it('rejects a truncated download instead of keeping a partial month', () => {
    const truncated = govUkCsv().split('\n').slice(0, 41).join('\n')
    expect(() => parseGovUkMonthlyCsv(truncated)).toThrow(/only 40 rates/)
  })
})

describe('bundled HMRC monthly rates', () => {
  it('cover every month from January 2015 to the last bundled month', async () => {
    const expected: string[] = []
    for (let d = new Date(`${FIRST_BUNDLED_MONTH}-01`); ; d.setUTCMonth(d.getUTCMonth() + 1)) {
      const key = d.toISOString().slice(0, 7)
      if (key > LAST_BUNDLED_MONTH) break
      expected.push(key)
    }
    const months: Record<string, Record<string, number>> = {}
    for (const load of Object.values(BUNDLED_MONTHLY_YEARS)) Object.assign(months, (await load()).default.months)

    expect(FIRST_BUNDLED_MONTH).toBe('2015-01')
    expect(LAST_BUNDLED_MONTH >= '2026-11').toBe(true)
    expect(Object.keys(months).sort()).toEqual(expected)
    for (const rates of Object.values(months)) {
      expect(Object.keys(rates).length).toBeGreaterThanOrEqual(100)
      expect(rates.USD).toBeGreaterThan(1)
      expect(rates.EUR).toBeGreaterThan(1)
    }
  })

  it('leave out every known typo', async () => {
    for (const entry of EXCLUDED_RATES) {
      const [month, currency] = entry.split(' ')
      const { months } = (await BUNDLED_MONTHLY_YEARS[month.slice(0, 4)]()).default
      expect(months[month]).toBeDefined()
      expect(months[month][currency]).toBeUndefined()
    }
  })
})

describe('HMRCMonthlyProvider', () => {
  let fetchSpy: { mock: { calls: unknown[][] } } & ReturnType<typeof vi.fn>

  beforeEach(() => {
    setCacheBackends(createMemoryCacheBackends())
    // Bundled months must never reach the network
    mockFetch(() => new Response('unexpected', { status: 500 }))
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockFetch(handler: (url: string) => Response | Promise<Response>) {
    vi.restoreAllMocks()
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => handler(String(input))) as unknown as typeof fetchSpy
  }
  const fetchedUrls = () => fetchSpy.mock.calls.map(call => String(call[0]))

  async function cacheRate(id: string, rate: number, source: string) {
    const [, year, month, currency] = id.split('-')
    await getFxRateCache().put({ id, date: `${year}-${month}`, currency, rate, source, fxSource: 'HMRC_MONTHLY' })
  }
  const cacheOldMirrorRate = (id: string, rate: number) => cacheRate(id, rate, FXSourceAttributions.HMRC_MONTHLY)

  describe('bundled months', () => {
    it('reads gov.uk-era months from the bundle with no network request', async () => {
      const result = await new HMRCMonthlyProvider().getRate('2024-06-14', 'USD')

      expect(result.rate).toBe(1.2709)
      expect(result.source).toBe(GOV_UK_ATTRIBUTION)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('reads 2015-2020 from the bundled archive with no network request', async () => {
      const result = await new HMRCMonthlyProvider().getRate('2016-03-10', 'USD')

      expect(result.rate).toBe(1.4318)
      expect(result.source).toBe(ARCHIVE_ATTRIBUTION)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('knows which months are bundled', () => {
      expect(isBundledMonth('2014-12')).toBe(false)
      expect(isBundledMonth('2015-01')).toBe(true)
      expect(isBundledMonth(LAST_BUNDLED_MONTH)).toBe(true)
      expect(isBundledMonth('2099-06')).toBe(false)
    })

    it('fails clearly on a known typo, in the archive or in HMRC\'s gov.uk files', async () => {
      // HMRC's April 2019 file has BRL 439943 (about 5 in the months around it)
      await expect(new HMRCMonthlyProvider().getRate('2019-04-10', 'BRL'))
        .rejects.toThrow(/BRL not found.*known error/)
      // gov.uk's March 2022 file has KHR 3041.70 (about 5400 around it)
      await expect(new HMRCMonthlyProvider().getRate('2022-03-10', 'KHR'))
        .rejects.toThrow(/KHR not found.*known error/)
      expect((await new HMRCMonthlyProvider().getRate('2019-04-10', 'USD')).rate).toBe(1.3188)
    })

    it('fails clearly for a currency HMRC doesn\'t list', async () => {
      await expect(new HMRCMonthlyProvider().getRate('2024-06-14', 'ZZZ')).rejects.toThrow(/ZZZ not found in HMRC rates for 2024\/06$/)
    })

    it('fails clearly before 2015', async () => {
      await expect(new HMRCMonthlyProvider().getRate('2014-12-10', 'USD')).rejects.toThrow(/only available from 2015/)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('prefers the bundle to any cached rate, so a correction applies at once', async () => {
      await cacheRate('HMRC_MONTHLY-2024-06-USD', 9.99, GOV_UK_ATTRIBUTION)
      await cacheOldMirrorRate('HMRC_MONTHLY-2016-03-USD', 9.99)

      expect((await new HMRCMonthlyProvider().getRate('2024-06-14', 'USD')).rate).toBe(1.2709)
      expect((await new HMRCMonthlyProvider().getRate('2016-03-10', 'USD')).rate).toBe(1.4318)
    })

    it('never brings back a cached typo, even when the bundle fails to load', async () => {
      // e.g. a tab open across a deploy can't fetch the year's chunk any more
      class BundleUnavailable extends HMRCMonthlyProvider {
        protected loadBundledYear(): never {
          throw new Error('Failed to fetch dynamically imported module')
        }
      }
      // Cached by earlier versions: from the mirror, and from gov.uk at runtime
      await cacheOldMirrorRate('HMRC_MONTHLY-2019-04-BRL', 439943)
      await cacheRate('HMRC_MONTHLY-2022-03-KHR', 3041.7012, GOV_UK_ATTRIBUTION)

      await expect(new BundleUnavailable().getRate('2019-04-10', 'BRL')).rejects.toThrow(/dynamically imported module/)
      await expect(new BundleUnavailable().getRate('2022-03-10', 'KHR')).rejects.toThrow(/dynamically imported module/)
    })
  })

  describe('months after the bundle: gov.uk', () => {
    it('reads the gov.uk monthly file', async () => {
      mockFetch(() => new Response(govUkCsv()))

      const result = await new HMRCMonthlyProvider().getRate(LATER, 'USD')

      expect(result.rate).toBe(1.2711)
      expect(result.source).toBe(GOV_UK_ATTRIBUTION)
      expect(fetchedUrls()).toEqual([LATER_URL])
    })

    it('downloads each month once for all currencies', async () => {
      mockFetch(() => new Response(govUkCsv()))
      const provider = new HMRCMonthlyProvider()

      const [usd, eur] = await Promise.all([
        provider.getRate('2099-06-03', 'USD'),
        provider.getRate('2099-06-20', 'EUR'),
      ])

      expect(usd.rate).toBe(1.2711)
      expect(eur.rate).toBe(1.1695)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('fails clearly when gov.uk has no file for the month, without trying anywhere else', async () => {
      mockFetch(() => new Response('{"errors":[{"detail":"not found"}]}', { status: 404 }))

      await expect(new HMRCMonthlyProvider().getRate('2099-01-10', 'USD'))
        .rejects.toThrow(/USD in 2099\/01.*no HMRC rates file/)
      expect(fetchedUrls()).toEqual([govUkMonthlyCsvUrl('2099', '01')])
    })

    it('fails on a network error or an unusable file instead of guessing', async () => {
      mockFetch(() => Promise.reject(new TypeError('Failed to fetch')))
      await expect(new HMRCMonthlyProvider().getRate(LATER, 'USD')).rejects.toThrow(/Failed to fetch/)

      mockFetch(() => new Response('<html>Service unavailable</html>'))
      await expect(new HMRCMonthlyProvider().getRate(LATER, 'USD')).rejects.toThrow()
    })

    it('does not keep a truncated month for the session', async () => {
      let calls = 0
      const truncated = govUkCsv().split('\n').slice(0, 41).join('\n')
      mockFetch(() => new Response(++calls === 1 ? truncated : govUkCsv()))
      const provider = new HMRCMonthlyProvider()

      await expect(provider.getRate(LATER, 'XEZ')).rejects.toThrow(/only 40 rates/)
      expect((await provider.getRate(LATER, 'XEZ')).rate).toBeGreaterThan(0)
    })

    it('retries a month after a failure', async () => {
      let calls = 0
      mockFetch(() => (++calls === 1 ? Promise.reject(new TypeError('Failed to fetch')) : new Response(govUkCsv())))
      const provider = new HMRCMonthlyProvider()

      await expect(provider.getRate(LATER, 'USD')).rejects.toThrow()
      expect((await provider.getRate(LATER, 'USD')).rate).toBe(1.2711)
    })

    it('keeps the label for a rate read back from the cache', async () => {
      mockFetch(() => new Response(govUkCsv()))
      await new HMRCMonthlyProvider().getRate(LATER, 'USD')
      fetchSpy.mockClear()

      const cached = await new HMRCMonthlyProvider().getRate(LATER, 'USD')

      expect(cached.source).toBe(GOV_UK_ATTRIBUTION)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('replaces a rate cached from the mirror by earlier versions', async () => {
      await cacheOldMirrorRate('HMRC_MONTHLY-2099-06-USD', 9.99)
      mockFetch(() => new Response(govUkCsv()))

      const result = await new HMRCMonthlyProvider().getRate(LATER, 'USD')

      expect([result.rate, result.source]).toEqual([1.2711, GOV_UK_ATTRIBUTION])
    })

    it('uses a rate cached by an earlier version when gov.uk is unreachable', async () => {
      await cacheOldMirrorRate('HMRC_MONTHLY-2099-06-USD', 1.2711)
      mockFetch(() => Promise.reject(new TypeError('Failed to fetch')))

      const result = await new HMRCMonthlyProvider().getRate(LATER, 'USD')

      expect(result.rate).toBe(1.2711)
      expect(result.source).toBe(FXSourceAttributions.HMRC_MONTHLY)
    })

    it('keeps rates cached under any label this version wrote, not just today\'s wording', async () => {
      await cacheRate('HMRC_MONTHLY-2099-06-USD', 1.2711, 'HMRC monthly rates, reworded (gov.uk)')
      mockFetch(() => new Response(govUkCsv()))

      const result = await new HMRCMonthlyProvider().getRate(LATER, 'USD')

      expect(result.source).toBe('HMRC monthly rates, reworded (gov.uk)')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('does not use a cached rate for a currency gov.uk no longer lists', async () => {
      await cacheOldMirrorRate('HMRC_MONTHLY-2099-06-ZZZ', 2.5)
      mockFetch(() => new Response(govUkCsv()))

      await expect(new HMRCMonthlyProvider().getRate(LATER, 'ZZZ')).rejects.toThrow(/ZZZ not found/)
    })
  })
})

describe('FxEnricher with HMRC monthly rates', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows on each transaction whether its rate came from gov.uk or the archive', async () => {
    setCacheBackends(createMemoryCacheBackends())
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(govUkCsv()))
    const tx = (id: string, date: string) => ({
      id, source: 'Test', symbol: 'AAPL', name: null, date, type: 'BUY', quantity: 1, price: 100,
      currency: 'USD', total: 100, fee: 0, notes: null,
    }) as EnrichedTransaction

    const [later, recent, old] = await new FxEnricher('HMRC_MONTHLY').enrich([
      tx('a', LATER), tx('b', '2024-06-14'), tx('c', '2016-03-10'),
    ])

    expect(later.fx_source).toBe(GOV_UK_ATTRIBUTION)
    expect(recent.fx_source).toBe(GOV_UK_ATTRIBUTION)
    expect(old.fx_source).toBe(ARCHIVE_ATTRIBUTION)
  })
})
