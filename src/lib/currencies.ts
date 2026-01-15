/**
 * Fiat Currency Constants
 *
 * Centralized list of supported fiat currencies for transaction parsing and FX conversion.
 * This ensures consistency across parsers (e.g., Coinbase Pro) and enrichers (e.g., FX Enricher).
 *
 * All currencies listed here support automatic FX conversion to GBP.
 * Crypto currencies (BTC, ETH, etc.) are NOT included and require manual GBP values.
 */

/**
 * List of all supported fiat currencies.
 * Used to distinguish fiat trades from crypto-to-crypto trades.
 */
export const FIAT_CURRENCIES = [
  'GBP', 'USD', 'EUR', 'CAD', 'AUD', 'CHF', 'JPY', 'CNY', 'HKD', 'SGD',
  'NZD', 'SEK', 'NOK', 'DKK', 'INR', 'ZAR', 'MXN', 'BRL', 'KRW', 'TWD',
  'THB', 'MYR', 'IDR', 'PHP', 'PLN', 'CZK', 'HUF', 'TRY', 'ILS', 'AED',
  'SAR', 'RUB', 'BGN', 'HRK', 'ISK', 'RON'
]

/**
 * Check if a currency is a supported fiat currency.
 * Returns false for crypto currencies (BTC, ETH, etc.)
 *
 * @param currency - The currency code to check (e.g., "GBP", "BTC", "ETH")
 * @returns true if the currency is a recognized fiat currency, false otherwise
 *
 * @example
 * isFiatCurrency("GBP") // true
 * isFiatCurrency("SEK") // true
 * isFiatCurrency("BTC") // false
 * isFiatCurrency("ETH") // false
 */
export function isFiatCurrency(currency: string): boolean {
  return FIAT_CURRENCIES.includes(currency.toUpperCase())
}
