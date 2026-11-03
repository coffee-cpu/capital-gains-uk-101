import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  HMRCMonthlyProvider,
  MIRROR_ATTRIBUTION,
  govUkMonthlyCsvUrl,
  mirrorMonthlyJsonUrl,
  parseGovUkMonthlyCsv,
} from '../hmrcMonthly'
import { createMemoryCacheBackends, setCacheBackends } from '../../../cache'
import { FXSourceAttributions } from '../../../../types/fxSource'
import { FxEnricher } from '../../../enrichment/enrichers/fxEnricher'
import type { EnrichedTransaction } from '../../../../types/transaction'

/** A gov.uk-style monthly CSV: USD 1.2711, EUR 1.1695 and filler currencies */
function govUkCsv(): string {
  const rows = [
    'Country/Territories,Currency,Currency Code,Currency Units per £1,Start date,End date',
    'USA,Dollar,USD,1.2711,01/06/2024,30/06/2024',
    'Eurozone,Euro,EUR,1.1695,01/06/2024,30/06/2024',
    '"Korea, South",Won,KRW,1745.12,01/06/2024,30/06/2024',
  ]
  for (let i = 0; i < 25; i++) {
    const code = 'X' + String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))
    rows.push(`Somewhere ${i},Unit,${code},${(i + 1) * 1.5},01/06/2024,30/06/2024`)
  }
  return rows.join('\n')
}

const mirrorJson = JSON.stringify({
  base: 'GBP',
  period: { start: '2016-03-01', end: '2016-03-31' },
  rates: { USD: '1.4040', EUR: '1.2905' },
})

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
})

describe('HMRCMonthlyProvider', () => {
  let fetchSpy: { mock: { calls: unknown[][] } } & ReturnType<typeof vi.fn>

  beforeEach(() => {
    setCacheBackends(createMemoryCacheBackends())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockFetch(handler: (url: string) => Response | Promise<Response>) {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => handler(String(input))) as unknown as typeof fetchSpy
  }

  it('uses the gov.uk monthly file and never contacts the mirror when it works', async () => {
    mockFetch(url => url === govUkMonthlyCsvUrl('2024', '06')
      ? new Response(govUkCsv())
      : new Response('unexpected', { status: 500 }))
    const provider = new HMRCMonthlyProvider()

    const result = await provider.getRate('2024-06-14', 'USD')

    expect(result.rate).toBe(1.2711)
    expect(result.source).toBe(FXSourceAttributions.HMRC_MONTHLY)
    expect(fetchSpy.mock.calls.map(call => String(call[0]))).toEqual([govUkMonthlyCsvUrl('2024', '06')])
  })

  it('downloads each month once for all currencies', async () => {
    mockFetch(() => new Response(govUkCsv()))
    const provider = new HMRCMonthlyProvider()

    await Promise.all([provider.getRate('2024-06-03', 'USD'), provider.getRate('2024-06-20', 'EUR')])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['not published (404)', () => new Response('Not found', { status: 404 })],
    ['an error page instead of a CSV', () => new Response('<html>Service unavailable</html>')],
    ['blocked or unreachable (e.g. CORS)', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('falls back to the mirror when gov.uk is %s, and labels the rate', async (_case, govUkResponse) => {
    mockFetch(url => url.startsWith('https://www.trade-tariff.service.gov.uk')
      ? govUkResponse()
      : url === mirrorMonthlyJsonUrl('2016', '03') ? new Response(mirrorJson) : new Response('', { status: 404 }))
    const provider = new HMRCMonthlyProvider()

    const result = await provider.getRate('2016-03-10', 'USD')

    expect(result.rate).toBe(1.404)
    expect(result.source).toBe(MIRROR_ATTRIBUTION)
  })

  it('keeps the mirror label for a rate read back from the cache', async () => {
    mockFetch(url => url.startsWith('https://www.trade-tariff.service.gov.uk')
      ? new Response('Not found', { status: 404 })
      : new Response(mirrorJson))
    await new HMRCMonthlyProvider().getRate('2016-03-10', 'USD')

    const fromCache = await new HMRCMonthlyProvider().getRate('2016-03-10', 'USD')

    expect(fromCache.source).toBe(MIRROR_ATTRIBUTION)
    expect(fetchSpy).toHaveBeenCalledTimes(2) // gov.uk + mirror for the first lookup only
  })

  it('skips an unusable mirror entry without failing the rest of the month', async () => {
    mockFetch(url => url.startsWith('https://www.trade-tariff.service.gov.uk')
      ? new Response('Not found', { status: 404 })
      : new Response(JSON.stringify({ base: 'GBP', period: {}, rates: { USD: '1.4040', XYZ: '', ABC: 'n/a' } })))
    const provider = new HMRCMonthlyProvider()

    expect((await provider.getRate('2016-03-10', 'USD')).rate).toBe(1.404)
    await expect(provider.getRate('2016-03-10', 'XYZ')).rejects.toThrow(/XYZ not found/)
  })

  it('fails clearly when neither source has the month', async () => {
    mockFetch(() => new Response('Not found', { status: 404 }))
    await expect(new HMRCMonthlyProvider().getRate('2099-01-10', 'USD')).rejects.toThrow(/2099\/01/)
  })
})

describe('FxEnricher with HMRC monthly rates', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows on each transaction whether its rate came from gov.uk or the mirror', async () => {
    setCacheBackends(createMemoryCacheBackends())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input)
      if (url === govUkMonthlyCsvUrl('2024', '06')) return new Response(govUkCsv())
      if (url.startsWith('https://www.trade-tariff.service.gov.uk')) return new Response('', { status: 404 })
      return new Response(mirrorJson)
    })
    const tx = (id: string, date: string) => ({
      id, source: 'Test', symbol: 'AAPL', name: null, date, type: 'BUY', quantity: 1, price: 100,
      currency: 'USD', total: 100, fee: 0, notes: null,
    }) as EnrichedTransaction

    const [recent, old] = await new FxEnricher('HMRC_MONTHLY').enrich([tx('a', '2024-06-14'), tx('b', '2016-03-10')])

    expect(recent.fx_source).toBe(FXSourceAttributions.HMRC_MONTHLY)
    expect(old.fx_source).toBe(MIRROR_ATTRIBUTION)
  })
})
