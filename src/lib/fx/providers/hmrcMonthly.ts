import { FXStrategy } from '../../../types/fxStrategy'
import { BaseFXProvider } from './base'

/**
 * HMRC Monthly Rates Provider
 *
 * Uses HMRC's official monthly exchange rates for tax purposes.
 * Each month has a single fixed rate that applies to all transactions in that month.
 *
 * API: https://hmrc.matchilling.com/rate/YYYY/MM.json
 * Official source: https://www.trade-tariff.service.gov.uk/exchange_rates/monthly
 *
 * @see https://github.com/matchilling/hmrc-exchange-rates
 */
export class HMRCMonthlyProvider extends BaseFXProvider {
  readonly strategy: FXStrategy = 'HMRC_MONTHLY'

  /**
   * Generate cache key in format: HMRC_MONTHLY-YYYY-MM-CURRENCY
   */
  getCacheKey(date: string, currency: string): string {
    const dateKey = this.getDateKey(date)
    return `${this.strategy}-${dateKey}-${currency}`
  }

  /**
   * Extract year-month from ISO date
   */
  protected getDateKey(date: string): string {
    const [year, month] = date.split('-')
    return `${year}-${month}`
  }

  /**
   * Fetch rate from HMRC API
   */
  protected async fetchRate(date: string, currency: string): Promise<number> {
    if (currency === 'GBP') {
      return 1
    }

    const [year, month] = date.split('-')
    const url = `https://hmrc.matchilling.com/rate/${year}/${month}.json`

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HMRC API error: ${response.status}`)
      }

      const data: HMRCRateResponse = await response.json()
      const rateStr = data.rates[currency]

      if (!rateStr) {
        throw new Error(`Currency ${currency} not found in HMRC rates for ${year}/${month}`)
      }

      const rate = parseFloat(rateStr)

      if (isNaN(rate) || rate <= 0) {
        throw new Error(`Invalid rate from HMRC API: ${rateStr}`)
      }

      // The API returns how many units of currency per 1 GBP
      // For example, if USD rate is 1.27, it means 1 GBP = 1.27 USD
      return rate
    } catch (error) {
      console.error(`Failed to fetch HMRC FX rate for ${currency} in ${year}/${month}:`, error)
      throw new Error(
        `Failed to fetch HMRC FX rate for ${currency} in ${year}/${month}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}

/**
 * HMRC API response format
 */
interface HMRCRateResponse {
  base: string
  period: {
    start: string
    end: string
  }
  rates: Record<string, string>
}
