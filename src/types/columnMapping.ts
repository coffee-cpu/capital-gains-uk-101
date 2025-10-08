import { z } from 'zod'

/**
 * Represents a mapping from CSV column to GenericTransaction field
 */
export const ColumnMappingSchema = z.object({
  // Required fields
  date: z.string().describe('CSV column name for transaction date'),
  type: z.string().describe('CSV column name for transaction type'),

  // Optional fields
  symbol: z.string().optional().describe('CSV column name for stock symbol'),
  name: z.string().optional().describe('CSV column name for asset name'),
  quantity: z.string().optional().describe('CSV column name for quantity'),
  price: z.string().optional().describe('CSV column name for price per unit'),
  currency: z.string().optional().describe('CSV column name for currency'),
  total: z.string().optional().describe('CSV column name for total value'),
  fee: z.string().optional().describe('CSV column name for fees'),
  notes: z.string().optional().describe('CSV column name for notes'),
})

export type ColumnMapping = z.infer<typeof ColumnMappingSchema>

/**
 * Saved mapping template
 */
export const MappingTemplateSchema = z.object({
  id: z.string().describe('Unique template ID'),
  name: z.string().describe('User-friendly template name (e.g., "My Broker Format")'),
  brokerName: z.string().optional().describe('Broker name if applicable'),
  mapping: ColumnMappingSchema,
  createdAt: z.string().datetime().describe('When template was created'),
})

export type MappingTemplate = z.infer<typeof MappingTemplateSchema>

/**
 * Available target fields that can be mapped
 */
export const MAPPABLE_FIELDS = [
  { key: 'date', label: 'Date', required: true },
  { key: 'type', label: 'Transaction Type', required: true },
  { key: 'symbol', label: 'Symbol/Ticker', required: false },
  { key: 'name', label: 'Asset Name', required: false },
  { key: 'quantity', label: 'Quantity', required: false },
  { key: 'price', label: 'Price per Unit', required: false },
  { key: 'currency', label: 'Currency', required: false },
  { key: 'total', label: 'Total Value', required: false },
  { key: 'fee', label: 'Fees/Commission', required: false },
  { key: 'notes', label: 'Notes', required: false },
] as const
