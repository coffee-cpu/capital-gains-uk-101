import { z } from 'zod'

/**
 * Generic Transaction Schema - normalized input format
 * Based on the specification in docs/SPECIFICATION.md
 */
export const GenericTransactionSchema = z.object({
  id: z.string().describe('Locally generated unique identifier'),
  source: z.string().describe('Broker or source file name'),
  symbol: z.string().describe('Stock ticker or ISIN code'),
  name: z.string().nullable().describe('Full name of the asset'),
  date: z.string().date().describe('Transaction date in YYYY-MM-DD format'),
  type: z.enum([
    'BUY',
    'SELL',
    'DIVIDEND',
    'FEE',
    'INTEREST',
    'TRANSFER',
    'TAX',
    'STOCK_SPLIT',
    // Options trading types
    'OPTIONS_BUY_TO_OPEN',
    'OPTIONS_SELL_TO_OPEN',
    'OPTIONS_BUY_TO_CLOSE',
    'OPTIONS_SELL_TO_CLOSE',
    'OPTIONS_ASSIGNED',
    'OPTIONS_EXPIRED',
    'OPTIONS_STOCK_SPLIT',
  ]).describe('Transaction type'),
  quantity: z.number().nullable().describe('Quantity bought or sold'),
  price: z.number().nullable().describe('Price per unit in transaction currency'),
  currency: z.string().describe('Original transaction currency (e.g. USD, EUR, GBP)'),
  total: z.number().nullable().describe('Total value in original currency'),
  fee: z.number().nullable().describe('Fee or commission amount'),
  notes: z.string().nullable().describe('Optional broker notes'),
  ratio: z.string().nullable().optional().describe('Stock split ratio (e.g., "10:1", "2:1", "1:10"). Only used for STOCK_SPLIT transactions.'),
  incomplete: z.boolean().optional().describe('True if transaction is missing required data (e.g., Stock Plan Activity without price)'),
  ignored: z.boolean().optional().describe('True if transaction should be excluded from calculations (e.g., Stock Plan Activity which is always incomplete)'),
  is_short_sell: z.boolean().optional().describe('True if this is an explicit short sell as reported by the broker (e.g., Schwab "Sell Short" action)'),
  imported_at: z.string().optional().describe('ISO timestamp when transaction was imported (e.g., 2024-01-15T10:30:00.000Z)'),

  // Options-specific fields
  underlying_symbol: z.string().nullable().optional().describe('For options: the underlying stock symbol (e.g., GOOGL)'),
  option_type: z.enum(['CALL', 'PUT']).nullable().optional().describe('For options: CALL or PUT'),
  strike_price: z.number().nullable().optional().describe('For options: strike price'),
  expiration_date: z.string().nullable().optional().describe('For options: expiration date in YYYY-MM-DD format'),
  contract_size: z.number().nullable().optional().describe('For options: shares per contract (typically 100)'),

  // Dividend withholding tax fields (for SA106 reporting)
  grossDividend: z.number().nullable().optional().describe('Gross dividend amount before withholding tax (in original currency)'),
  withholdingTax: z.number().nullable().optional().describe('Tax withheld at source on dividends (in original currency)'),
})

export type GenericTransaction = z.infer<typeof GenericTransactionSchema>

/**
 * Enriched Transaction Schema - computed attributes added in browser
 */
export const EnrichedTransactionSchema = GenericTransactionSchema.extend({
  // Stock split adjustments (computed during enrichment, Step 1)
  split_adjusted_quantity: z.number().nullable().optional().describe('Quantity adjusted for all stock splits that occurred after this transaction'),
  split_adjusted_price: z.number().nullable().optional().describe('Price adjusted for all stock splits (price decreases when shares increase)'),
  split_multiplier: z.number().optional().describe('Cumulative multiplier applied (e.g., 2.0 for 2:1 split, 10.0 for 10:1, 1.0 if no splits)'),
  applied_splits: z.array(z.string()).optional().describe('Array of stock split transaction IDs that were applied to normalize this transaction'),

  // FX conversion (computed during enrichment, Step 2)
  fx_rate: z.number().describe('FX rate used for GBP conversion'),
  price_gbp: z.number().nullable().describe('Price per unit in GBP'),
  split_adjusted_price_gbp: z.number().nullable().optional().describe('Split-adjusted price per unit in GBP (price_gbp adjusted for stock splits)'),
  value_gbp: z.number().nullable().describe('Total value in GBP'),
  fee_gbp: z.number().nullable().describe('Fee amount in GBP'),
  fx_source: z.string().describe('Source of FX rate (e.g. Bank of England)'),
  fx_error: z.string().nullable().optional().describe('Error message if FX rate fetch failed'),

  // Dividend withholding tax in GBP (for SA106 reporting)
  grossDividend_gbp: z.number().nullable().optional().describe('Gross dividend amount in GBP'),
  withholdingTax_gbp: z.number().nullable().optional().describe('Tax withheld at source in GBP'),

  // Tax year and CGT matching (computed during enrichment, Step 3)
  tax_year: z.string().describe('UK tax year (e.g. 2023/24)'),
  gain_group: z.enum(['SAME_DAY', '30_DAY', 'SECTION_104', 'SHORT_SELL', 'NONE']).describe('HMRC matching rule applied'),
  match_groups: z.array(z.string()).optional().describe('Array of match group IDs this transaction belongs to. A single acquisition can match multiple disposals, so this is an array.'),
})

export type EnrichedTransaction = z.infer<typeof EnrichedTransactionSchema>

/**
 * Transaction type enum for easier use
 */
export const TransactionType = {
  BUY: 'BUY',
  SELL: 'SELL',
  DIVIDEND: 'DIVIDEND',
  FEE: 'FEE',
  INTEREST: 'INTEREST',
  TRANSFER: 'TRANSFER',
  TAX: 'TAX',
  STOCK_SPLIT: 'STOCK_SPLIT',
  // Options trading types
  OPTIONS_BUY_TO_OPEN: 'OPTIONS_BUY_TO_OPEN',
  OPTIONS_SELL_TO_OPEN: 'OPTIONS_SELL_TO_OPEN',
  OPTIONS_BUY_TO_CLOSE: 'OPTIONS_BUY_TO_CLOSE',
  OPTIONS_SELL_TO_CLOSE: 'OPTIONS_SELL_TO_CLOSE',
  OPTIONS_ASSIGNED: 'OPTIONS_ASSIGNED',
  OPTIONS_EXPIRED: 'OPTIONS_EXPIRED',
  OPTIONS_STOCK_SPLIT: 'OPTIONS_STOCK_SPLIT',
} as const

/**
 * Gain group type enum
 */
export const GainGroup = {
  SAME_DAY: 'SAME_DAY',
  THIRTY_DAY: '30_DAY',
  SECTION_104: 'SECTION_104',
  SHORT_SELL: 'SHORT_SELL',
  NONE: 'NONE',
} as const

/**
 * Stock Split Event
 * Represents a stock split/reorganisation under HMRC TCGA92/S127
 */
export interface StockSplitEvent {
  id: string                      // Transaction ID of the split event
  date: string                    // ISO format: YYYY-MM-DD
  symbol: string                  // e.g., "NVDA", "AAPL"
  ratio: string                   // e.g., "2:1", "10:1", "1:10" (reverse split)
  ratioMultiplier: number         // e.g., 2.0, 10.0, 0.1
  source: string                  // e.g., "Trading 212", "Generic CSV"
  originalTransaction?: GenericTransaction  // For audit trail
}

/**
 * Parse split ratio string to multiplier
 * @example "2:1" → 2.0 (2-for-1 split, shares double)
 * @example "10:1" → 10.0 (10-for-1 split, shares 10x)
 * @example "1:10" → 0.1 (1-for-10 reverse split, shares /10)
 */
export function parseRatioMultiplier(ratio: string): number {
  const parts = ratio.split(':')
  if (parts.length !== 2) {
    throw new Error(`Invalid split ratio format: "${ratio}". Expected format: "new:old" (e.g., "2:1")`)
  }

  const newShares = parseFloat(parts[0])
  const oldShares = parseFloat(parts[1])

  if (isNaN(newShares) || isNaN(oldShares) || oldShares === 0) {
    throw new Error(`Invalid split ratio values: "${ratio}"`)
  }

  return newShares / oldShares
}
