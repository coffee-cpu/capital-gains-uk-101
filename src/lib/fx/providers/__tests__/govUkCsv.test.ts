import { describe, it, expect } from 'vitest'
import { parseGovUkRatesCsv } from '../govUkCsv'

describe('parseGovUkRatesCsv', () => {
  it('reads the yearly average format from 2023 (with a Currency Code column)', () => {
    const csv = [
      'Country,Unit Of Currency,Currency Code,Sterling value of Currency Unit £,Currency Units per £1',
      'Abu Dhabi,Dirham,AED,0.2130,4.6959',
      'USA,Dollar,USD,0.7825,1.2779',
    ].join('\n')

    expect(parseGovUkRatesCsv(csv, 1)).toEqual({ AED: 4.6959, USD: 1.2779 })
  })

  it('reads the yearly average format before 2023 by mapping country names', () => {
    const csv = [
      'Country,Unit of Currency,Sterling value of Currency Unit,Currency Units per pound',
      'Abu Dhabi,Dirham ,0.2180,4.587583',
      'USA,Dollar,0.8090,1.236079',
      'Atlantis,Shell,0.5,2',
    ].join('\n')

    // Countries without a known currency are skipped
    expect(parseGovUkRatesCsv(csv, 1)).toEqual({ AED: 4.587583, USD: 1.236079 })
  })

  it('handles quoted fields and Windows line endings', () => {
    const csv = 'Country/Territories,Currency,Currency Code,Currency Units per £1\r\n"Korea, South",Won,KRW,"1745.12"\r\n'

    expect(parseGovUkRatesCsv(csv, 1)).toEqual({ KRW: 1745.12 })
  })

  it('skips a row cut off before its last column, which may hold a truncated rate', () => {
    const csv = [
      'Country/Territories,Currency,Currency Code,Currency Units per £1,Start date,End date',
      'Eurozone,Euro,EUR,1.1695,01/06/2024,30/06/2024',
      'USA,Dollar,USD,1.2',
    ].join('\n')

    expect(parseGovUkRatesCsv(csv, 1)).toEqual({ EUR: 1.1695 })
  })

  it('rejects unknown columns and files with too few rates', () => {
    expect(() => parseGovUkRatesCsv('a,b,c\n1,2,3', 1)).toThrow(/unexpected columns/)
    expect(() => parseGovUkRatesCsv('Country,Currency Code,Currency Units per £1\nUSA,USD,1.27', 2)).toThrow(/only 1 rates/)
  })
})
