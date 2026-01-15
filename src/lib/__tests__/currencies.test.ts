import { describe, it, expect } from 'vitest'
import { FIAT_CURRENCIES, isFiatCurrency } from '../currencies'

describe('Currency Module', () => {
  describe('FIAT_CURRENCIES', () => {
    it('should contain all 36 supported fiat currencies', () => {
      expect(FIAT_CURRENCIES).toHaveLength(36)
    })

    it('should include common currencies', () => {
      const commonCurrencies = ['GBP', 'USD', 'EUR', 'CAD', 'AUD', 'CHF', 'JPY']
      commonCurrencies.forEach(currency => {
        expect(FIAT_CURRENCIES).toContain(currency)
      })
    })

    it('should include Nordic currencies (SEK, NOK, DKK)', () => {
      expect(FIAT_CURRENCIES).toContain('SEK')
      expect(FIAT_CURRENCIES).toContain('NOK')
      expect(FIAT_CURRENCIES).toContain('DKK')
    })

    it('should include Asian currencies', () => {
      const asianCurrencies = ['CNY', 'HKD', 'SGD', 'INR', 'KRW', 'TWD', 'THB', 'MYR', 'IDR', 'PHP']
      asianCurrencies.forEach(currency => {
        expect(FIAT_CURRENCIES).toContain(currency)
      })
    })

    it('should not contain crypto currencies', () => {
      const cryptoCurrencies = ['BTC', 'ETH', 'LINK', 'XRP', 'LTC', 'BCH', 'ADA', 'DOT', 'UNI']
      cryptoCurrencies.forEach(currency => {
        expect(FIAT_CURRENCIES).not.toContain(currency)
      })
    })

    it('should be uppercase', () => {
      FIAT_CURRENCIES.forEach(currency => {
        expect(currency).toBe(currency.toUpperCase())
        expect(currency).toMatch(/^[A-Z]{3}$/)
      })
    })
  })

  describe('isFiatCurrency', () => {
    describe('Valid fiat currencies', () => {
      it('should return true for all 36 supported fiat currencies', () => {
        FIAT_CURRENCIES.forEach(currency => {
          expect(isFiatCurrency(currency)).toBe(true)
        })
      })

      it('should return true for GBP', () => {
        expect(isFiatCurrency('GBP')).toBe(true)
      })

      it('should return true for USD', () => {
        expect(isFiatCurrency('USD')).toBe(true)
      })

      it('should return true for EUR', () => {
        expect(isFiatCurrency('EUR')).toBe(true)
      })

      it('should return true for SEK (critical for BTC-SEK bug fix)', () => {
        expect(isFiatCurrency('SEK')).toBe(true)
      })

      it('should return true for NOK', () => {
        expect(isFiatCurrency('NOK')).toBe(true)
      })

      it('should return true for SGD', () => {
        expect(isFiatCurrency('SGD')).toBe(true)
      })

      it('should return true for CNY', () => {
        expect(isFiatCurrency('CNY')).toBe(true)
      })

      it('should return true for INR', () => {
        expect(isFiatCurrency('INR')).toBe(true)
      })
    })

    describe('Case insensitivity', () => {
      it('should be case-insensitive for uppercase', () => {
        expect(isFiatCurrency('GBP')).toBe(true)
        expect(isFiatCurrency('USD')).toBe(true)
        expect(isFiatCurrency('EUR')).toBe(true)
      })

      it('should be case-insensitive for lowercase', () => {
        expect(isFiatCurrency('gbp')).toBe(true)
        expect(isFiatCurrency('usd')).toBe(true)
        expect(isFiatCurrency('eur')).toBe(true)
        expect(isFiatCurrency('sek')).toBe(true)
      })

      it('should be case-insensitive for mixed case', () => {
        expect(isFiatCurrency('Gbp')).toBe(true)
        expect(isFiatCurrency('UsD')).toBe(true)
        expect(isFiatCurrency('eUr')).toBe(true)
        expect(isFiatCurrency('SeK')).toBe(true)
      })
    })

    describe('Crypto currencies', () => {
      it('should return false for BTC', () => {
        expect(isFiatCurrency('BTC')).toBe(false)
      })

      it('should return false for ETH', () => {
        expect(isFiatCurrency('ETH')).toBe(false)
      })

      it('should return false for LINK', () => {
        expect(isFiatCurrency('LINK')).toBe(false)
      })

      it('should return false for XRP', () => {
        expect(isFiatCurrency('XRP')).toBe(false)
      })

      it('should return false for common crypto currencies', () => {
        const cryptoCurrencies = [
          'BTC', 'ETH', 'LINK', 'XRP', 'LTC', 'BCH', 'ADA', 'DOT', 'UNI',
          'MATIC', 'SOL', 'AVAX', 'ATOM', 'ALGO', 'DOGE', 'SHIB'
        ]

        cryptoCurrencies.forEach(currency => {
          expect(isFiatCurrency(currency)).toBe(false)
        })
      })

      it('should return false for crypto currencies in lowercase', () => {
        expect(isFiatCurrency('btc')).toBe(false)
        expect(isFiatCurrency('eth')).toBe(false)
        expect(isFiatCurrency('link')).toBe(false)
      })
    })

    describe('Edge cases', () => {
      it('should return false for empty string', () => {
        expect(isFiatCurrency('')).toBe(false)
      })

      it('should return false for non-existent currency codes', () => {
        expect(isFiatCurrency('XXX')).toBe(false)
        expect(isFiatCurrency('ZZZ')).toBe(false)
        expect(isFiatCurrency('ABC')).toBe(false)
      })

      it('should return false for invalid formats', () => {
        expect(isFiatCurrency('US')).toBe(false)
        expect(isFiatCurrency('USDD')).toBe(false)
        expect(isFiatCurrency('123')).toBe(false)
      })

      it('should return false for numbers', () => {
        expect(isFiatCurrency('123')).toBe(false)
      })

      it('should return false for special characters', () => {
        expect(isFiatCurrency('$$$')).toBe(false)
        expect(isFiatCurrency('£££')).toBe(false)
      })
    })
  })
})
