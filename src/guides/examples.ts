import { escapeHtml, formatDate, gbp } from './html'

/**
 * Worked examples shown in the rule guides. Each one is run through the real
 * calculation engine in src/guides/__tests__/examples.test.ts, so the figures
 * on the pages can't drift from what the calculator does.
 */

export interface ExampleTransaction {
  date: string
  type: 'BUY' | 'SELL' | 'STOCK_SPLIT'
  quantity?: number
  /** Price per share in GBP */
  price?: number
  /** e.g. "10:1" for a STOCK_SPLIT */
  splitRatio?: string
  /** Shown instead of "Buy" or "Sell", e.g. "RSU vest" */
  label?: string
}

export interface ExpectedMatch {
  rule: 'same-day' | '30-day' | 'section-104'
  quantity: number
  costGbp: number
}

export interface WorkedExample {
  symbol: string
  transactions: ExampleTransaction[]
  /** The single disposal the example produces */
  disposal: {
    date: string
    quantity: number
    proceedsGbp: number
    allowableCostsGbp: number
    gainOrLossGbp: number
    matches: ExpectedMatch[]
  }
  /** Section 104 pool left after the last transaction */
  poolAfter: { quantity: number; costGbp: number }
}

export const SAME_DAY_EXAMPLE: WorkedExample = {
  symbol: 'ACME',
  transactions: [
    { date: '2025-03-03', type: 'BUY', quantity: 100, price: 10 },
    { date: '2025-06-10', type: 'BUY', quantity: 50, price: 14 },
    { date: '2025-06-10', type: 'SELL', quantity: 80, price: 15 },
  ],
  disposal: {
    date: '2025-06-10',
    quantity: 80,
    proceedsGbp: 1200,
    allowableCostsGbp: 1000,
    gainOrLossGbp: 200,
    matches: [
      { rule: 'same-day', quantity: 50, costGbp: 700 },
      { rule: 'section-104', quantity: 30, costGbp: 300 },
    ],
  },
  poolAfter: { quantity: 70, costGbp: 700 },
}

export const THIRTY_DAY_EXAMPLE: WorkedExample = {
  symbol: 'ACME',
  transactions: [
    { date: '2024-05-01', type: 'BUY', quantity: 1000, price: 5 },
    { date: '2025-03-03', type: 'SELL', quantity: 1000, price: 4 },
    { date: '2025-03-20', type: 'BUY', quantity: 1000, price: 4.1 },
  ],
  disposal: {
    date: '2025-03-03',
    quantity: 1000,
    proceedsGbp: 4000,
    allowableCostsGbp: 4100,
    gainOrLossGbp: -100,
    matches: [{ rule: '30-day', quantity: 1000, costGbp: 4100 }],
  },
  poolAfter: { quantity: 1000, costGbp: 5000 },
}

export const SECTION_104_EXAMPLE: WorkedExample = {
  symbol: 'ACME',
  transactions: [
    { date: '2023-01-10', type: 'BUY', quantity: 100, price: 10 },
    { date: '2023-06-15', type: 'BUY', quantity: 200, price: 13 },
    { date: '2024-02-01', type: 'SELL', quantity: 150, price: 15 },
  ],
  disposal: {
    date: '2024-02-01',
    quantity: 150,
    proceedsGbp: 2250,
    allowableCostsGbp: 1800,
    gainOrLossGbp: 450,
    matches: [{ rule: 'section-104', quantity: 150, costGbp: 1800 }],
  },
  poolAfter: { quantity: 150, costGbp: 1800 },
}

export const STOCK_SPLIT_EXAMPLE: WorkedExample = {
  symbol: 'ACME',
  transactions: [
    { date: '2022-03-01', type: 'BUY', quantity: 10, price: 1000 },
    { date: '2022-08-01', type: 'STOCK_SPLIT', splitRatio: '10:1' },
    { date: '2023-05-02', type: 'SELL', quantity: 50, price: 120 },
  ],
  disposal: {
    date: '2023-05-02',
    quantity: 50,
    proceedsGbp: 6000,
    allowableCostsGbp: 5000,
    gainOrLossGbp: 1000,
    matches: [{ rule: 'section-104', quantity: 50, costGbp: 5000 }],
  },
  poolAfter: { quantity: 50, costGbp: 5000 },
}

/** RSU vests are acquisitions at market value, so a vest just after a sale is matched under the 30-day rule */
export const RSU_EXAMPLE: WorkedExample = {
  symbol: 'ACME',
  transactions: [
    { date: '2024-09-16', type: 'BUY', quantity: 40, price: 400, label: 'RSU vest' },
    { date: '2024-12-16', type: 'BUY', quantity: 40, price: 500, label: 'RSU vest' },
    { date: '2025-03-10', type: 'SELL', quantity: 60, price: 600 },
    { date: '2025-03-17', type: 'BUY', quantity: 20, price: 580, label: 'RSU vest' },
  ],
  disposal: {
    date: '2025-03-10',
    quantity: 60,
    proceedsGbp: 36000,
    allowableCostsGbp: 29600,
    gainOrLossGbp: 6400,
    matches: [
      { rule: '30-day', quantity: 20, costGbp: 11600 },
      { rule: 'section-104', quantity: 40, costGbp: 18000 },
    ],
  },
  poolAfter: { quantity: 40, costGbp: 18000 },
}

/** The overview guide's example: shares bought years apart, then a sale from the pool */
export const OVERVIEW_EXAMPLE: WorkedExample = {
  symbol: 'ACME',
  transactions: [
    { date: '2016-05-03', type: 'BUY', quantity: 400, price: 20 },
    { date: '2022-11-14', type: 'BUY', quantity: 600, price: 30 },
    { date: '2025-09-15', type: 'SELL', quantity: 500, price: 50 },
  ],
  disposal: {
    date: '2025-09-15',
    quantity: 500,
    proceedsGbp: 25000,
    allowableCostsGbp: 13000,
    gainOrLossGbp: 12000,
    matches: [{ rule: 'section-104', quantity: 500, costGbp: 13000 }],
  },
  poolAfter: { quantity: 500, costGbp: 13000 },
}

/**
 * The rest of the overview example: the year's totals and the tax. The
 * engine works out the taxable gain (checked in the tests); the rate split
 * needs the person's income, so the example assumes how much of the basic
 * rate band is left.
 */
export const OVERVIEW_TAX = {
  taxYear: '2025/26',
  annualExemptAmountGbp: 3000,
  taxableGainGbp: 9000,
  unusedBasicRateBandGbp: 4000,
  basicRate: 18,
  higherRate: 24,
}

/** Tax on a taxable gain: the part within the unused basic rate band at the basic rate, the rest at the higher rate */
export function splitTaxByBand(taxableGain: number, unusedBasicRateBand: number, basicRate: number, higherRate: number) {
  const atBasicRate = Math.min(taxableGain, Math.max(0, unusedBasicRateBand))
  const atHigherRate = taxableGain - atBasicRate
  const basicTax = atBasicRate * basicRate / 100
  const higherTax = atHigherRate * higherRate / 100
  return { atBasicRate, atHigherRate, basicTax, higherTax, total: basicTax + higherTax }
}

export const WORKED_EXAMPLES = {
  overview: OVERVIEW_EXAMPLE,
  sameDay: SAME_DAY_EXAMPLE,
  thirtyDay: THIRTY_DAY_EXAMPLE,
  section104: SECTION_104_EXAMPLE,
  stockSplit: STOCK_SPLIT_EXAMPLE,
  rsu: RSU_EXAMPLE,
}

/** 2025-06-10 → 10 June 2025 */
export function longDate(iso: string): string {
  return formatDate(iso)
}

/** The example's transactions as a Generic CSV, which the calculator imports directly */
export function exampleToGenericCsv(example: WorkedExample): string {
  const rows = example.transactions.map(tx => {
    const total = tx.quantity !== undefined && tx.price !== undefined ? tx.quantity * tx.price : ''
    return [tx.date, tx.type, example.symbol, 'GBP', tx.quantity ?? '', tx.price ?? '', total, tx.type === 'STOCK_SPLIT' ? '' : 0, tx.splitRatio ?? ''].join(',')
  })
  return ['date,type,symbol,currency,quantity,price,total,fee,split_ratio', ...rows].join('\n')
}

/** Table of the example's transactions */
export function renderTransactionsTable(example: WorkedExample): string {
  const rows = example.transactions.map(tx => {
    if (tx.type === 'STOCK_SPLIT') {
      return `<tr><td>${longDate(tx.date)}</td><td>Stock split ${escapeHtml(tx.splitRatio ?? '')}</td><td class="num"></td><td class="num"></td><td class="num"></td></tr>`
    }
    const total = (tx.quantity ?? 0) * (tx.price ?? 0)
    return `<tr><td>${longDate(tx.date)}</td><td>${escapeHtml(tx.label ?? (tx.type === 'BUY' ? 'Buy' : 'Sell'))}</td><td class="num">${tx.quantity?.toLocaleString('en-GB')}</td><td class="num">${gbp(tx.price ?? 0)}</td><td class="num">${gbp(total)}</td></tr>`
  })
  return `<table><thead><tr><th>Date</th><th>Transaction</th><th class="num">Shares</th><th class="num">Price</th><th class="num">Total</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
}

const RULE_NAMES: Record<ExpectedMatch['rule'], string> = {
  'same-day': 'Same-day rule',
  '30-day': '30-day rule',
  'section-104': 'Section 104 pool',
}

/** Table of how the disposal was matched, with the resulting gain or loss */
export function renderResultTable(example: WorkedExample): string {
  const { disposal } = example
  const rows = disposal.matches.map(m =>
    `<tr><td>${RULE_NAMES[m.rule]}</td><td class="num">${m.quantity.toLocaleString('en-GB')}</td><td class="num">${gbp(m.costGbp)}</td></tr>`
  )
  return `<table><thead><tr><th>Matched with</th><th class="num">Shares</th><th class="num">Allowable cost</th></tr></thead><tbody>${rows.join('')}</tbody></table>
<div class="callout calc">
<p>Proceeds: ${gbp(disposal.proceedsGbp)}</p>
<p>Less allowable costs: ${gbp(disposal.allowableCostsGbp)}</p>
<p><strong>${disposal.gainOrLossGbp < 0 ? 'Loss' : 'Gain'}: ${gbp(Math.abs(disposal.gainOrLossGbp))}</strong></p>
<p>Section 104 pool afterwards: ${example.poolAfter.quantity.toLocaleString('en-GB')} shares, cost ${gbp(example.poolAfter.costGbp)}</p>
</div>`
}
