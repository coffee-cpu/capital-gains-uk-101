import { describe, it, expect } from 'vitest'
import { getAnnualExemptAmount, getDividendAllowance, getDividendTaxRates } from '../allowances'
import { getHelpContent } from '../../../utils/helpContent'

describe('getAnnualExemptAmount', () => {
  it.each([
    ['2013/14', 11000], // before the table: earliest amount
    ['2014/15', 11000],
    ['2015/16', 11100],
    ['2016/17', 11100],
    ['2017/18', 11300],
    ['2018/19', 11700],
    ['2019/20', 12000],
    ['2020/21', 12300],
    ['2022/23', 12300],
    ['2023/24', 6000],
    ['2024/25', 3000],
    ['2026/27', 3000], // after the table: latest amount
  ])('%s is £%i', (taxYear, amount) => {
    expect(getAnnualExemptAmount(taxYear)).toBe(amount)
  })
})

describe('getDividendAllowance', () => {
  it.each([
    ['2015/16', 0],
    ['2016/17', 5000],
    ['2017/18', 5000],
    ['2018/19', 2000],
    ['2022/23', 2000],
    ['2023/24', 1000],
    ['2024/25', 500],
    ['2026/27', 500],
  ])('%s is £%i', (taxYear, amount) => {
    expect(getDividendAllowance(taxYear)).toBe(amount)
  })
})

describe('getDividendTaxRates', () => {
  // GOV.UK "Income Tax rates and allowances for current and past years"
  it.each([
    ['2015/16', null],
    ['2016/17', { basic: 7.5, higher: 32.5, additional: 38.1 }],
    ['2021/22', { basic: 7.5, higher: 32.5, additional: 38.1 }],
    ['2022/23', { basic: 8.75, higher: 33.75, additional: 39.35 }],
    ['2025/26', { basic: 8.75, higher: 33.75, additional: 39.35 }],
    ['2026/27', { basic: 10.75, higher: 35.75, additional: 39.35 }],
  ])('%s', (taxYear, rates) => {
    expect(getDividendTaxRates(taxYear)).toEqual(rates)
  })

  it('feeds the dividend help text', () => {
    expect(getHelpContent('dividend').explanation).toContain([
      '- 2026/27 onwards: 10.75% basic, 35.75% higher, 39.35% additional',
      '- 2022/23 to 2025/26: 8.75% basic, 33.75% higher, 39.35% additional',
      '- 2016/17 to 2021/22: 7.5% basic, 32.5% higher, 38.1% additional',
    ].join('\n'))
  })
})
