import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FxEnricher } from '../fxEnricher'
import { createMemoryCacheBackends, setCacheBackends } from '../../../cache'
import type { EnrichedTransaction } from '../../../../types/transaction'

/** A buy in June 2024, a month the bundled HMRC monthly rates cover */
const buy = (overrides: Partial<EnrichedTransaction> = {}) => ({
  id: 'tx', source: 'Test', symbol: 'ACME', name: null, date: '2024-06-14', type: 'BUY',
  quantity: 10, price: 50, currency: 'USD', total: 500, fee: 2, notes: null, ...overrides,
}) as EnrichedTransaction

describe('FxEnricher: fee currency', () => {
  beforeEach(() => {
    setCacheBackends(createMemoryCacheBackends())
    // Bundled rates only
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('converts the fee at the trade rate when it has no currency of its own', async () => {
    const [tx] = await new FxEnricher('HMRC_MONTHLY').enrich([buy()])
    expect(tx.fx_rate).toBeGreaterThan(1)
    expect(tx.fee_gbp).toBeCloseTo(2 / tx.fx_rate!, 10)
  })

  it('keeps a GBP fee as it is on a USD trade', async () => {
    const [tx] = await new FxEnricher('HMRC_MONTHLY').enrich([buy({ fee_currency: 'GBP' })])
    expect(tx.fee_gbp).toBe(2)
    // The trade itself is still converted at the USD rate
    expect(tx.value_gbp).toBeCloseTo(500 / tx.fx_rate!, 10)
  })

  it("converts a fee in a third currency at that currency's rate", async () => {
    const enricher = new FxEnricher('HMRC_MONTHLY')
    const [withEurFee, eurTrade] = await enricher.enrich([
      buy({ fee_currency: 'EUR' }),
      buy({ id: 'eur', currency: 'EUR' }),
    ])
    expect(withEurFee.fee_gbp).toBeCloseTo(2 / eurTrade.fx_rate!, 10)
    expect(withEurFee.fx_rate).not.toBe(eurTrade.fx_rate)
  })

  it('treats a fee currency equal to the trade currency as no fee currency', async () => {
    const [tx] = await new FxEnricher('HMRC_MONTHLY').enrich([buy({ fee_currency: 'usd' })])
    expect(tx.fee_gbp).toBeCloseTo(2 / tx.fx_rate!, 10)
  })
})
