import { describe, it, expect, afterEach } from 'vitest'
import { acquisitionLinesByDay, formatReportDate } from '../cgtReportDocument'
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
