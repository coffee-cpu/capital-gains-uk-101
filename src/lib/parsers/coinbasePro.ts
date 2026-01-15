import type { GenericTransaction } from '../../types/transaction'
import type { RawCSVRow } from '../../types/broker'
import { isFiatCurrency } from '../currencies'

/**
 * Coinbase Pro CSV Parser
 *
 * Converts Coinbase Pro (formerly GDAX) transaction exports to GenericTransaction format
 *
 * Expected columns:
 * - portfolio: Portfolio name (e.g., "default")
 * - trade id: Unique trade identifier
 * - product: Trading pair (e.g., "XRP-GBP", "LINK-ETH", "BTC-GBP")
 * - side: BUY or SELL
 * - created at: ISO 8601 timestamp (e.g., "2020-10-14T10:42:20.072Z")
 * - size: Quantity of base asset
 * - size unit: Base asset symbol (e.g., "XRP", "LINK")
 * - price: Price per unit in quote currency
 * - fee: Fee amount in quote currency
 * - total: Total amount (negative for buys, positive for sells)
 * - price/fee/total unit: Quote currency (e.g., "GBP", "ETH")
 * - gbp_value (optional): User-provided spot price of the quote currency in GBP
 *   For crypto-to-crypto trades (e.g., LINK-ETH), this is the GBP price per unit of ETH.
 *   Total and fee are then calculated by multiplying with this price.
 */

/**
 * Parse product trading pair into base and quote currencies
 * e.g., "XRP-GBP" -> { base: "XRP", quote: "GBP" }
 * e.g., "LINK-ETH" -> { base: "LINK", quote: "ETH" }
 */
function parseProduct(product: string): { base: string; quote: string } | null {
  if (!product) return null

  const parts = product.split('-')
  if (parts.length !== 2) return null

  return {
    base: parts[0].toUpperCase(),
    quote: parts[1].toUpperCase(),
  }
}

/**
 * Parse ISO 8601 timestamp to date string
 * e.g., "2020-10-14T10:42:20.072Z" -> "2020-10-14"
 *
 * @param timestamp - ISO 8601 formatted timestamp string
 * @returns Date in YYYY-MM-DD format
 * @throws Error if timestamp is invalid or malformed
 */
function parseISO8601Date(timestamp: string): string {
  // Validate input exists and is a string
  if (!timestamp || typeof timestamp !== 'string') {
    throw new Error('Invalid timestamp: empty or non-string value')
  }

  // Split on 'T' to extract date part
  const parts = timestamp.split('T')
  if (parts.length === 0 || !parts[0]) {
    throw new Error(`Invalid ISO 8601 timestamp format: "${timestamp}"`)
  }

  const datePart = parts[0]

  // Validate basic YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    throw new Error(
      `Invalid date format in timestamp: "${timestamp}". Expected YYYY-MM-DD`
    )
  }

  return datePart
}

/**
 * Parse numeric value, handling potential edge cases
 */
function parseNumber(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null

  const parsed = parseFloat(value)
  return isNaN(parsed) ? null : parsed
}

/**
 * Normalize Coinbase Pro transactions to GenericTransaction format
 *
 * For fiat pairs (e.g., XRP-GBP, BTC-GBP):
 * - Creates a single BUY or SELL transaction
 *
 * For crypto-to-crypto pairs (e.g., LINK-ETH):
 * - Creates TWO transactions:
 *   1. SELL of quote currency (e.g., ETH) - disposal
 *   2. BUY of base currency (e.g., LINK) - acquisition
 * - If user provides 'gbp_value' column, uses it for GBP totals
 * - If missing, warns user to add GBP value for proper CGT calculation
 */
export function normalizeCoinbaseProTransactions(
  rows: RawCSVRow[],
  fileId: string
): GenericTransaction[] {
  const transactions: GenericTransaction[] = []
  let transactionIndex = 1

  for (const row of rows) {
    const product = row['product']
    const side = row['side']
    const timestamp = row['created at']
    const tradeId = row['trade id']

    // Skip rows without essential data
    if (!product || !side || !timestamp) continue

    // Skip header rows
    if (side === 'side') continue

    const productPair = parseProduct(product)
    if (!productPair) {
      console.warn(`Coinbase Pro: Could not parse product "${product}"`)
      continue
    }

    const { base, quote } = productPair

    // Parse numeric fields
    const size = parseNumber(row['size'])
    const price = parseNumber(row['price'])
    const fee = parseNumber(row['fee'])
    const total = parseNumber(row['total'])
    const gbpValue = parseNumber(row['gbp_value'])

    // Date in YYYY-MM-DD format
    const date = parseISO8601Date(timestamp)

    // Determine if this is a fiat or crypto-to-crypto trade
    const isFiatTrade = isFiatCurrency(quote)

    if (isFiatTrade) {
      // Simple fiat trade (e.g., XRP-GBP, BTC-GBP)
      // Create a single BUY or SELL transaction
      const type = side.toUpperCase() === 'BUY' ? 'BUY' : 'SELL'

      const transaction: GenericTransaction = {
        id: `${fileId}-${transactionIndex++}`,
        source: 'Coinbase Pro',
        date,
        type,
        symbol: base,
        name: null,
        quantity: size !== null ? Math.abs(size) : null,
        price: price !== null ? Math.abs(price) : null,
        currency: quote,
        total: total !== null ? Math.abs(total) : null,
        fee: fee !== null ? Math.abs(fee) : null,
        notes: tradeId ? `Trade ID: ${tradeId}` : null,
      }

      transactions.push(transaction)
    } else {
      // Crypto-to-crypto trade (e.g., LINK-ETH)
      // Generate TWO transactions: SELL of quote + BUY of base

      const isBuy = side.toUpperCase() === 'BUY'
      const absTotal = total !== null ? Math.abs(total) : null // Amount of quote currency
      const absFee = fee !== null ? Math.abs(fee) : null // Fee in quote currency
      const absSize = size !== null ? Math.abs(size) : null // Amount of base currency

      // gbp_value is the spot price of the QUOTE currency in GBP
      // e.g., for LINK-ETH, gbp_value is the GBP price per ETH
      const hasGbpValue = gbpValue !== null

      // Calculate GBP totals by multiplying quote amounts with GBP spot price
      const gbpTotal = hasGbpValue && absTotal !== null ? gbpValue * absTotal : null
      const gbpFee = hasGbpValue && absFee !== null ? gbpValue * absFee : null

      // Warning note for missing GBP value
      const gbpWarning = !hasGbpValue
        ? ' [⚠️ Add gbp_value column with GBP spot price of quote currency for accurate CGT calculation]'
        : ''

      if (isBuy) {
        // User is BUYING base (LINK) by SELLING quote (ETH)
        // 1. SELL transaction for quote currency (ETH being spent)
        const sellTransaction: GenericTransaction = {
          id: `${fileId}-${transactionIndex++}`,
          source: 'Coinbase Pro',
          date,
          type: 'SELL',
          symbol: quote,
          name: null,
          quantity: absTotal, // Amount of quote currency spent (e.g., 0.52 ETH)
          price: hasGbpValue ? gbpValue : null, // GBP price per unit of quote currency
          currency: hasGbpValue ? 'GBP' : quote,
          total: gbpTotal ?? absTotal,
          fee: gbpFee ?? absFee,
          notes: `[Crypto-to-Crypto Disposal] Trade ID: ${tradeId}${gbpWarning}`,
        }
        transactions.push(sellTransaction)

        // 2. BUY transaction for base currency (LINK being acquired)
        // The GBP price per base unit = total GBP value / quantity of base
        const gbpPricePerBase = gbpTotal !== null && absSize !== null && absSize > 0
          ? gbpTotal / absSize
          : null
        const buyTransaction: GenericTransaction = {
          id: `${fileId}-${transactionIndex++}`,
          source: 'Coinbase Pro',
          date,
          type: 'BUY',
          symbol: base,
          name: null,
          quantity: absSize, // Amount of base acquired (e.g., 28.23 LINK)
          price: gbpPricePerBase ?? price, // GBP price per unit of base, or original crypto price
          currency: hasGbpValue ? 'GBP' : quote,
          total: gbpTotal ?? absTotal,
          fee: 0, // Fee already accounted for in SELL
          notes: `[Crypto-to-Crypto Acquisition] Trade ID: ${tradeId}${gbpWarning}`,
        }
        transactions.push(buyTransaction)
      } else {
        // User is SELLING base (LINK) to receive quote (ETH)
        // The GBP price per base unit = total GBP value / quantity of base
        const gbpPricePerBase = gbpTotal !== null && absSize !== null && absSize > 0
          ? gbpTotal / absSize
          : null

        // 1. SELL transaction for base currency (LINK being sold)
        const sellTransaction: GenericTransaction = {
          id: `${fileId}-${transactionIndex++}`,
          source: 'Coinbase Pro',
          date,
          type: 'SELL',
          symbol: base,
          name: null,
          quantity: absSize, // Amount of base sold
          price: gbpPricePerBase ?? price, // GBP price per unit of base
          currency: hasGbpValue ? 'GBP' : quote,
          total: gbpTotal ?? absTotal,
          fee: gbpFee ?? absFee,
          notes: `[Crypto-to-Crypto Disposal] Trade ID: ${tradeId}${gbpWarning}`,
        }
        transactions.push(sellTransaction)

        // 2. BUY transaction for quote currency (ETH being acquired)
        const buyTransaction: GenericTransaction = {
          id: `${fileId}-${transactionIndex++}`,
          source: 'Coinbase Pro',
          date,
          type: 'BUY',
          symbol: quote,
          name: null,
          quantity: absTotal, // Amount of quote received
          price: hasGbpValue ? gbpValue : 1, // GBP price per unit of quote currency
          currency: hasGbpValue ? 'GBP' : quote,
          total: gbpTotal ?? absTotal,
          fee: 0, // Fee already accounted for in SELL
          notes: `[Crypto-to-Crypto Acquisition] Trade ID: ${tradeId}${gbpWarning}`,
        }
        transactions.push(buyTransaction)
      }
    }
  }

  return transactions
}
