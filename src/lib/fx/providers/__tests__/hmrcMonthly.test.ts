import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  HMRCMonthlyProvider,
  ARCHIVE_ATTRIBUTION,
  GOV_UK_ATTRIBUTION,
  govUkMonthlyCsvUrl,
  parseGovUkMonthlyCsv,
} from '../hmrcMonthly'
import { createMemoryCacheBackends, setCacheBackends } from '../../../cache'
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
    'USA,Dollar,USD,1.2711,01/06/2024,30/06/2024',
    'Eurozone,Euro,EUR,1.1695,01/06/2024,30/06/2024',
    '"Korea, South",Won,KRW,1745.12,01/06/2024,30/06/2024',
  ]
  for (let i = 0; i < 157; i++) {
    const code = 'X' + String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))
    rows.push(`Somewhere ${i},Unit,${code},${(i + 1) * 1.5},01/06/2024,30/06/2024`)
  }
  return rows.join('\n')
}

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

describe('HMRCMonthlyProvider', () => {
  let fetchSpy: { mock: { calls: unknown[][] } } & ReturnType<typeof vi.fn>

  beforeEach(() => {
    setCacheBackends(createMemoryCacheBackends())
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockFetch(handler: (url: string) => Response | Promise<Response>) {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => handler(String(input))) as unknown as typeof fetchSpy
  }
  const fetchedUrls = () => fetchSpy.mock.calls.map(call => String(call[0]))

  async function cacheOldMirrorRate(id: string, rate: number) {
    const { getFxRateCache } = await import('../../../cache')
    const [, year, month, currency] = id.split('-')
    await getFxRateCache().put({
      id, date: `${year}-${month}`, currency, rate,
      source: FXSourceAttributions.HMRC_MONTHLY, fxSource: 'HMRC_MONTHLY',
    })
  }

  describe('from January 2021: gov.uk only', () => {
    it('reads the gov.uk monthly file', async () => {
      mockFetch(() => new Response(govUkCsv()))

      const result = await new HMRCMonthlyProvider().getRate('2024-06-14', 'USD')

      expect(result.rate).toBe(1.2711)
      expect(result.source).toBe(GOV_UK_ATTRIBUTION)
      expect(fetchedUrls()).toEqual([govUkMonthlyCsvUrl('2024', '06')])
    })

    it('downloads each month once for all currencies', async () => {
      mockFetch(() => new Response(govUkCsv()))
      const provider = new HMRCMonthlyProvider()

      const [usd, eur] = await Promise.all([
        provider.getRate('2024-06-03', 'USD'),
        provider.getRate('2024-06-20', 'EUR'),
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
      await expect(new HMRCMonthlyProvider().getRate('2024-06-14', 'USD')).rejects.toThrow(/Failed to fetch/)

      mockFetch(() => new Response('<html>Service unavailable</html>'))
      await expect(new HMRCMonthlyProvider().getRate('2024-06-14', 'USD')).rejects.toThrow()
    })

    it('does not keep a truncated month for the session', async () => {
      let calls = 0
      const truncated = govUkCsv().split('\n').slice(0, 41).join('\n')
      mockFetch(() => new Response(++calls === 1 ? truncated : govUkCsv()))
      const provider = new HMRCMonthlyProvider()

      await expect(provider.getRate('2024-06-14', 'XEZ')).rejects.toThrow(/only 40 rates/)
      expect((await provider.getRate('2024-06-14', 'XEZ')).rate).toBeGreaterThan(0)
    })

    it('retries a month after a failure', async () => {
      let calls = 0
      mockFetch(() => (++calls === 1 ? Promise.reject(new TypeError('Failed to fetch')) : new Response(govUkCsv())))
      const provider = new HMRCMonthlyProvider()

      await expect(provider.getRate('2024-06-14', 'USD')).rejects.toThrow()
      expect((await provider.getRate('2024-06-14', 'USD')).rate).toBe(1.2711)
    })
  })

  describe('2015 to 2020: bundled archive', () => {
    it('reads old months from the archive with no network request', async () => {
      mockFetch(() => new Response('unexpected', { status: 500 }))

      const result = await new HMRCMonthlyProvider().getRate('2016-03-10', 'USD')

      expect(result.rate).toBe(1.4318)
      expect(result.source).toBe(ARCHIVE_ATTRIBUTION)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('covers every month from January 2015 to December 2020', async () => {
      const { default: archive } = await import('../../data/hmrcMonthlyArchive.json')
      const months = Object.keys(archive.months)

      expect(months).toHaveLength(72)
      expect(months[0]).toBe('2015-01')
      expect(months[71]).toBe('2020-12')
      for (const rates of Object.values(archive.months) as Record<string, number>[]) {
        expect(rates.USD).toBeGreaterThan(1)
        expect(rates.EUR).toBeGreaterThan(1)
      }
    })

    it('leaves out known typos, so the rate fails instead of being wildly wrong', async () => {
      // HMRC's April 2019 file has BRL 439943 (about 5 in the months around it)
      await expect(new HMRCMonthlyProvider().getRate('2019-04-10', 'BRL')).rejects.toThrow(/BRL not found/)
      expect((await new HMRCMonthlyProvider().getRate('2019-04-10', 'USD')).rate).toBe(1.3188)
    })

    it('fails clearly before 2015', async () => {
      await expect(new HMRCMonthlyProvider().getRate('2014-12-10', 'USD')).rejects.toThrow(/only available from 2015/)
    })
  })

  describe('cache', () => {
    it('keeps the label for a rate read back from the cache', async () => {
      mockFetch(() => new Response(govUkCsv()))
      await new HMRCMonthlyProvider().getRate('2024-06-14', 'USD')
      fetchSpy.mockClear()

      const cached = await new HMRCMonthlyProvider().getRate('2024-06-14', 'USD')

      expect(cached.source).toBe(GOV_UK_ATTRIBUTION)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('replaces rates cached from the mirror by earlier versions', async () => {
      await cacheOldMirrorRate('HMRC_MONTHLY-2024-06-USD', 9.99)
      await cacheOldMirrorRate('HMRC_MONTHLY-2016-03-USD', 9.99)
      mockFetch(() => new Response(govUkCsv()))
      const provider = new HMRCMonthlyProvider()

      const recent = await provider.getRate('2024-06-14', 'USD')
      const old = await provider.getRate('2016-03-10', 'USD')

      expect([recent.rate, recent.source]).toEqual([1.2711, GOV_UK_ATTRIBUTION])
      expect([old.rate, old.source]).toEqual([1.4318, ARCHIVE_ATTRIBUTION])
    })

    it('uses a rate cached by an earlier version when gov.uk is unreachable', async () => {
      await cacheOldMirrorRate('HMRC_MONTHLY-2024-06-USD', 1.2711)
      mockFetch(() => Promise.reject(new TypeError('Failed to fetch')))

      const result = await new HMRCMonthlyProvider().getRate('2024-06-14', 'USD')

      expect(result.rate).toBe(1.2711)
      expect(result.source).toBe(FXSourceAttributions.HMRC_MONTHLY)
    })

    it('does not bring back a cached typo that the archive leaves out', async () => {
      // The mirror-only version cached BRL 439943 for April 2019
      await cacheOldMirrorRate('HMRC_MONTHLY-2019-04-BRL', 439943)

      await expect(new HMRCMonthlyProvider().getRate('2019-04-10', 'BRL')).rejects.toThrow(/BRL not found/)
    })

    it('does not bring back a cached typo when the archive fails to load', async () => {
      // e.g. a tab open across a deploy can't fetch the archive chunk any more
      class ArchiveUnavailable extends HMRCMonthlyProvider {
        protected loadArchive(): never {
          throw new Error('Failed to fetch dynamically imported module')
        }
      }
      await cacheOldMirrorRate('HMRC_MONTHLY-2019-04-BRL', 439943)

      await expect(new ArchiveUnavailable().getRate('2019-04-10', 'BRL')).rejects.toThrow(/dynamically imported module/)
    })

    it('keeps rates cached under any label this version wrote, not just today\'s wording', async () => {
      const { getFxRateCache } = await import('../../../cache')
      await getFxRateCache().put({
        id: 'HMRC_MONTHLY-2024-06-USD', date: '2024-06', currency: 'USD', rate: 1.2711,
        source: 'HMRC monthly rates, reworded (gov.uk)', fxSource: 'HMRC_MONTHLY',
      })
      mockFetch(() => new Response(govUkCsv()))

      const result = await new HMRCMonthlyProvider().getRate('2024-06-14', 'USD')

      expect(result.source).toBe('HMRC monthly rates, reworded (gov.uk)')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('does not use a cached rate for a currency gov.uk no longer lists', async () => {
      await cacheOldMirrorRate('HMRC_MONTHLY-2024-06-ZZZ', 2.5)
      mockFetch(() => new Response(govUkCsv()))

      await expect(new HMRCMonthlyProvider().getRate('2024-06-14', 'ZZZ')).rejects.toThrow(/ZZZ not found/)
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

    const [recent, old] = await new FxEnricher('HMRC_MONTHLY').enrich([tx('a', '2024-06-14'), tx('b', '2016-03-10')])

    expect(recent.fx_source).toBe(GOV_UK_ATTRIBUTION)
    expect(old.fx_source).toBe(ARCHIVE_ATTRIBUTION)
  })
})
