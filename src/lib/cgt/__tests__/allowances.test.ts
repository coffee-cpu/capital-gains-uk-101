import { describe, it, expect } from 'vitest'
import { getAnnualExemptAmount, getDividendAllowance } from '../allowances'

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
