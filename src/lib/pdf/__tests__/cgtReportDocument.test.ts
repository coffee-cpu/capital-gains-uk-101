import { describe, it, expect, afterEach } from 'vitest'
import { acquisitionLinesByDay, formatReportDate, transactionHistoryRows, transactionTableCells } from '../cgtReportDocument'
import type { EnrichedTransaction } from '../../../types/transaction'

describe('formatReportDate', () => {
  const originalTZ = process.env.TZ
  afterEach(() => { process.env.TZ = originalTZ })

  it.each(['America/New_York', 'Europe/London', 'Pacific/Auckland'])(
    'prints the same calendar date in %s',
    timeZone => {
      process.env.TZ = timeZone

      expect(formatReportDate('2024-04-06')).toBe('06/04/2024')
      expect(formatReportDate('2025-04-05')).toBe('05/04/2025')
    }
  )
})

describe('acquisitionLinesByDay', () => {
  const lot = (date: string, quantityMatched: number, costBasisGbp: number) =>
    ({ transaction: { date } as EnrichedTransaction, quantityMatched, costBasisGbp })
  const share = { underlying_symbol: null }

  it('keeps a day with one lot on one line', () => {
    expect(acquisitionLinesByDay([lot('2024-06-10', 10, 1000)], share))
      .toEqual(['10/06/2024: 10 shares at £100.00 (cost: £1,000.00)'])
  })

  it('totals a day bought in several lots at one price, listing the lots', () => {
    const lots = [lot('2024-06-10', 10, 1000), lot('2024-06-10', 4, 400), lot('2024-06-10', 4, 400), lot('2024-06-10', 7, 700)]

    expect(acquisitionLinesByDay(lots, share))
      .toEqual(['10/06/2024: 25 shares at £100.00 (cost: £2,500.00), bought in 4 lots: 10, 4, 4, 7'])
  })

  it('lists each lot\'s price when a day\'s lots were bought at different prices', () => {
    const lots = [lot('2024-02-15', 10, 50), lot('2024-02-15', 5, 26)]

    expect(acquisitionLinesByDay(lots, share))
      .toEqual(['15/02/2024: 15 shares at an average of £5.07 (cost: £76.00), bought in 2 lots: 10 at £5.00, 5 at £5.20'])
  })

  it('keeps days apart, in order, and skips lots with nothing matched', () => {
    const lots = [lot('2024-02-15', 10, 50), lot('2024-02-20', 5, 30), lot('2024-02-15', 0, 0)]

    expect(acquisitionLinesByDay(lots, share)).toEqual([
      '15/02/2024: 10 shares at £5.00 (cost: £50.00)',
      '20/02/2024: 5 shares at £6.00 (cost: £30.00)',
    ])
  })

  it('counts option contracts in contracts', () => {
    const lots = [lot('2024-03-01', 1, 120), lot('2024-03-01', 2, 240)]

    expect(acquisitionLinesByDay(lots, { underlying_symbol: 'AAPL' }))
      .toEqual(['01/03/2024: 3 contracts at £120.00 (cost: £360.00), bought in 2 lots: 1, 2'])
  })
})

describe('transactionTableCells', () => {
  const tx = (fields: Partial<EnrichedTransaction>) =>
    ({ symbol: 'ABC', quantity: null, total: null, fee: null, price_gbp: null, value_gbp: null, fee_gbp: null, ...fields }) as EnrichedTransaction

  it('shows whole quantities without decimals or sign', () => {
    expect(transactionTableCells(tx({ type: 'BUY', quantity: 100, price_gbp: 10, value_gbp: 1000, fee_gbp: 0 })))
      .toEqual({ symbol: 'ABC', quantity: '100', price: '£10.00', value: '£1,000.00', fee: '-' })
    expect(transactionTableCells(tx({ type: 'OPTIONS_EXPIRED', quantity: -1 }))?.quantity).toBe('1')
    expect(transactionTableCells(tx({ type: 'BUY', quantity: 0.0086629, value_gbp: 50 }))?.quantity).toBe('0.0086629')
  })

  it('keeps a tiny quantity, even with no amounts', () => {
    expect(transactionTableCells(tx({ type: 'BUY', quantity: 0.001, total: 0 }))?.quantity).toBe('0.001')
  })

  it('keeps a stock split with no quantity or amounts', () => {
    expect(transactionTableCells(tx({ type: 'STOCK_SPLIT' }))).toMatchObject({ quantity: '-', value: '-' })
  })

  it('shows only the amount for a dividend', () => {
    expect(transactionTableCells(tx({ type: 'DIVIDEND', quantity: 10, price_gbp: 0.24, total: 3, value_gbp: 2.4 })))
      .toMatchObject({ quantity: '-', price: '-', value: '£2.40' })
  })

  it('leaves out a row with nothing to show', () => {
    expect(transactionTableCells(tx({ type: 'TAX', total: 0, value_gbp: 0 }))).toBeNull()
    expect(transactionTableCells(tx({ type: 'DIVIDEND', quantity: 10, total: 0, value_gbp: 0 }))).toBeNull()
  })

  it('keeps a row whose GBP value is missing', () => {
    expect(transactionTableCells(tx({ type: 'TRANSFER', total: 500 }))?.value).toBe('-')
  })

  it('shows a dash for a missing symbol', () => {
    expect(transactionTableCells(tx({ type: 'TRANSFER', symbol: '', total: 500, value_gbp: 500 }))?.symbol).toBe('-')
  })
})

describe('transactionHistoryRows', () => {
  const year = { startDate: '2024-04-06', endDate: '2025-04-05' }
  const tx = (id: string, date: string, extra: Partial<EnrichedTransaction> = {}) =>
    ({ id, date, symbol: 'AAPL', type: 'BUY', quantity: 1, total: 100, fee: 0, ...extra }) as EnrichedTransaction
  const transactions = [
    tx('after', '2025-04-06'),
    tx('in-year', '2024-04-06'),
    tx('year-end', '2025-04-05'),
    tx('earlier', '2020-01-01'),
    tx('ignored', '2024-05-01', { ignored: true }),
    tx('empty-cash', '2024-05-01', { type: 'DIVIDEND', quantity: 0, total: 0, fee: 0 }),
  ]
  const ids = (rows: EnrichedTransaction[]) => rows.map(row => row.id)

  it('lists nothing for none', () => {
    expect(transactionHistoryRows(transactions, year, 'none')).toEqual([])
  })

  it('lists only the tax year for tax-year, oldest first', () => {
    expect(ids(transactionHistoryRows(transactions, year, 'tax-year'))).toEqual(['in-year', 'year-end'])
  })

  it('lists everything up to the year end for all', () => {
    expect(ids(transactionHistoryRows(transactions, year, 'all'))).toEqual(['earlier', 'in-year', 'year-end'])
  })
})
