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
  type: z.enum(['BUY', 'SELL', 'DIVIDEND', 'FEE', 'INTEREST', 'TRANSFER', 'TAX']).describe('Transaction type'),
  quantity: z.number().nullable().describe('Quantity bought or sold'),
  price: z.number().nullable().describe('Price per unit in transaction currency'),
  currency: z.string().describe('Original transaction currency (e.g. USD, EUR, GBP)'),
  total: z.number().nullable().describe('Total value in original currency'),
  fee: z.number().nullable().describe('Fee or commission amount'),
  notes: z.string().nullable().describe('Optional broker notes'),
})

export type GenericTransaction = z.infer<typeof GenericTransactionSchema>

/**
 * Enriched Transaction Schema - computed attributes added in browser
 */
export const EnrichedTransactionSchema = GenericTransactionSchema.extend({
  fx_rate: z.number().describe('FX rate used for GBP conversion'),
  price_gbp: z.number().nullable().describe('Price per unit in GBP'),
  value_gbp: z.number().nullable().describe('Total value in GBP'),
  fee_gbp: z.number().nullable().describe('Fee amount in GBP'),
  fx_source: z.string().describe('Source of FX rate (e.g. Bank of England)'),
  tax_year: z.string().describe('UK tax year (e.g. 2023/24)'),
  gain_group: z.enum(['SAME_DAY', '30_DAY', 'SECTION_104', 'NONE']).describe('HMRC matching rule applied'),
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
} as const

/**
 * Gain group type enum
 */
export const GainGroup = {
  SAME_DAY: 'SAME_DAY',
  THIRTY_DAY: '30_DAY',
  SECTION_104: 'SECTION_104',
  NONE: 'NONE',
} as const
