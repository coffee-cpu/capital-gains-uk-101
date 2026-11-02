import { describe, it, expect } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import * as reactPdf from '@react-pdf/renderer'
import {
  buildCGTReportDocument,
  findReportDataIssues,
  formatQuantity,
  REPORT_DISCLAIMER,
  type ReactPdfLibrary,
} from '../cgtReportDocument'
import type { DisposalRecord, MatchingResult, TaxYearSummary } from '../../../types/cgt'
import type { EnrichedTransaction } from '../../../types/transaction'

/**
 * Stand-in for @react-pdf/renderer: primitives become plain tags, so the
 * document tree can be walked and its text read without rendering a PDF.
 */
const fakeLibrary = {
  Document: 'DOCUMENT',
  Page: 'PAGE',
  Text: 'TEXT',
  View: 'VIEW',
  StyleSheet: { create: <T,>(styles: T) => styles },
} as unknown as ReactPdfLibrary

/** All text in the document, one entry per top-level Text element */
function textLines(node: ReactNode): string[] {
  const lines: string[] = []
  const walk = (n: ReactNode, inText: boolean, out: string[]): void => {
    if (n == null || typeof n === 'boolean') return
    if (typeof n === 'string' || typeof n === 'number') {
      out.push(String(n))
      return
    }
    if (Array.isArray(n)) {
      n.forEach(child => walk(child, inText, out))
      return
    }
    if (!isValidElement(n)) return
    const el = n as ReactElement<{ children?: ReactNode }>
    if (typeof el.type === 'function') {
      walk((el.type as (p: unknown) => ReactNode)(el.props), inText, out)
      return
    }
    if (el.type === 'TEXT' && !inText) {
      const parts: string[] = []
      walk(el.props.children, true, parts)
      lines.push(parts.join(''))
      return
    }
    walk(el.props.children, inText, out)
  }
  walk(node, false, lines)
  return lines
}

function tx(overrides: Partial<EnrichedTransaction>): EnrichedTransaction {
  return {
    id: 'tx',
    source: 'Test',
    date: '2024-05-01',
    type: 'SELL',
    symbol: 'ABC',
    name: null,
    currency: 'GBP',
    quantity: 10,
    price: 5,
    total: 50,
    fee: null,
    notes: null,
    fx_rate: 1,
    price_gbp: 5,
    value_gbp: 50,
    fee_gbp: null,
    fx_source: 'Native GBP',
    tax_year: '2024/25',
    ...overrides,
  } as EnrichedTransaction
}

function matching(disposal: EnrichedTransaction, quantity: number, cost: number, rule: MatchingResult['rule'] = 'SECTION_104'): MatchingResult {
  return {
    disposal,
    acquisitions: [{ transaction: tx({ id: `${disposal.id}-buy`, type: 'BUY', date: '2024-04-10' }), quantityMatched: quantity, costBasisGbp: cost }],
    rule,
    quantityMatched: quantity,
    totalCostBasisGbp: cost,
  }
}

function record(disposal: EnrichedTransaction, matchings: MatchingResult[], unmatchedQuantity?: number): DisposalRecord {
  const cost = matchings.reduce((sum, m) => sum + m.totalCostBasisGbp, 0)
  return {
    id: `disposal-${disposal.id}`,
    disposal,
    matchings,
    proceedsGbp: 50,
    allowableCostsGbp: cost,
    gainOrLossGbp: 50 - cost,
    taxYear: '2024/25',
    unmatchedQuantity,
    isIncomplete: unmatchedQuantity !== undefined,
  }
}

function summary(disposals: DisposalRecord[]): TaxYearSummary {
  return {
    taxYear: '2024/25',
    startDate: '2024-04-06',
    endDate: '2025-04-05',
    disposals,
    totalDisposals: disposals.length,
    totalProceedsGbp: 0,
    totalAllowableCostsGbp: 0,
    totalGainsGbp: 0,
    totalLossesGbp: 0,
    netGainOrLossGbp: 0,
    annualExemptAmount: 3000,
    taxableGainGbp: 0,
    totalDividends: 0,
    totalDividendsGbp: 0,
    grossDividendsGbp: 0,
    totalWithholdingTaxGbp: 0,
    dividendAllowance: 500,
    totalInterest: 0,
    totalInterestGbp: 0,
    grossInterestGbp: 0,
    interestWithholdingTaxGbp: 0,
    incompleteDisposals: disposals.filter(d => d.isIncomplete).length,
  }
}

function render(disposals: DisposalRecord[], transactions: EnrichedTransaction[] = []): string[] {
  return textLines(
    buildCGTReportDocument(fakeLibrary, { taxYearSummary: summary(disposals), disposals, transactions })
  )
}

describe('CGT report document', () => {
  it('always ends with the disclaimer', () => {
    expect(render([])).toContain(REPORT_DISCLAIMER)
  })

  it('does not print a stray 0 when the sale fee is zero', () => {
    const sell = tx({ id: 's', fee_gbp: 0 })
    const lines = render([record(sell, [matching(sell, 10, 40)])])
    expect(lines).toContain('Sale price: £5.00 per share')
  })

  it('shows the fee when there is one', () => {
    const sell = tx({ id: 's', fee_gbp: 1.5 })
    const lines = render([record(sell, [matching(sell, 10, 40)])])
    expect(lines).toContain('Sale price: £5.00 per share (fees: £1.50)')
  })

  it('treats a split-adjusted disposal with no matches as fully unmatched', () => {
    const sell = tx({ id: 's', quantity: 10, split_adjusted_quantity: 40, split_adjusted_price_gbp: 1.25 })
    const lines = render([record(sell, [], 40)])
    expect(lines).toContain('No Matching Acquisitions')
    expect(lines.some(l => l.startsWith('Partially matched'))).toBe(false)
    expect(lines).toContain('40 shares (10 before split adjustment)')
    expect(lines).toContain('Sale price: £1.25 per share')
  })

  it('says a partially matched disposal only counts the matched part', () => {
    const sell = tx({ id: 's', symbol: 'BP', quantity: 1200 })
    const lines = render([record(sell, [matching(sell, 1000, 40, 'SAME_DAY')], 200)])
    const note = lines.find(l => l.startsWith('Partially matched'))
    expect(note).toContain('200 of 1,200 shares could not be matched')
    expect(note).toContain('cover only the 1,000 shares that were matched')
    expect(lines.find(l => l.startsWith('• 1 disposal(s)'))).toContain('BP on 01/05/2024: 200 shares unmatched')
  })

  it('labels options in contracts and prices them per underlying share', () => {
    const sell = tx({
      id: 's',
      type: 'OPTIONS_EXPIRED',
      symbol: 'NVDA 02/23/2024 1080.00 C',
      underlying_symbol: 'NVDA',
      contract_size: 100,
      quantity: -1,
      price_gbp: 0,
    })
    const lines = render([record(sell, [matching(sell, 1, 73.81)])])
    expect(lines).toContain('1 contract')
    expect(lines.some(l => l.includes('-1'))).toBe(false)
    expect(lines).toContain('Sale price: £0.00 per underlying share (100 shares per contract)')
    expect(lines).toContain('Pool average cost: £73.81 per contract (total: £73.81)')
  })

  it('keeps small crypto quantities and hides zero-quantity acquisition rows', () => {
    const sell = tx({ id: 's', symbol: 'ETH', quantity: 0.0086629 })
    const m = matching(sell, 0.0086629, 0.94, '30_DAY')
    m.acquisitions.push({ transaction: tx({ id: 'b2', type: 'BUY' }), quantityMatched: 0, costBasisGbp: 0 })
    const lines = render([record(sell, [m])])
    expect(lines).toContain('0.0086629 shares')
    expect(lines.filter(l => l.includes(' at £')).length).toBe(1)
  })

  it('warns at the top and on the card when an exchange rate is missing', () => {
    const sell = tx({ id: 's', symbol: 'ETH', currency: 'ETH', fx_rate: null, fx_error: 'no rate', price_gbp: null })
    const lines = render([record(sell, [matching(sell, 10, 40)])], [sell])
    expect(lines).toContain('Check before filing: this report is incomplete')
    expect(lines.find(l => l.startsWith('• No GBP exchange rate'))).toContain('1 ETH transaction(s)')
    expect(lines.some(l => l.startsWith('No GBP exchange rate for this sale'))).toBe(true)
  })

  it('has no warning box when the data is complete', () => {
    const sell = tx({ id: 's' })
    expect(render([record(sell, [matching(sell, 10, 40)])], [sell])).not.toContain(
      'Check before filing: this report is incomplete'
    )
  })

  it('renders to a PDF with the real library', async () => {
    const sell = tx({ id: 's', fee_gbp: 0 })
    const disposals = [record(sell, [matching(sell, 10, 40)])]
    const doc = buildCGTReportDocument(reactPdf, { taxYearSummary: summary(disposals), disposals, transactions: [sell] })
    const buffer = await reactPdf.renderToBuffer(doc)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })
})

describe('findReportDataIssues', () => {
  const year = summary([])

  it('counts missing rates for trades in assets sold this year, and income within the year', () => {
    const sold = tx({ id: 'sold', symbol: 'ABC', date: '2024-06-01' })
    const issues = findReportDataIssues(year, [record(sold, [])], [
      tx({ id: 'other-asset', type: 'BUY', symbol: 'XYZ', date: '2020-01-01', currency: 'USD', fx_error: 'x' }),
      tx({ id: 'old-buy', type: 'BUY', date: '2020-01-01', currency: 'USD', fx_error: 'x' }),
      tx({ id: 'div', type: 'DIVIDEND', date: '2024-06-01', currency: 'USD', fx_error: 'x' }),
      tx({ id: 'old-div', type: 'DIVIDEND', date: '2023-06-01', currency: 'USD', fx_error: 'x' }),
      tx({ id: 'next-year', type: 'SELL', date: '2025-04-06', currency: 'USD', fx_error: 'x' }),
      tx({ id: 'transfer', type: 'TRANSFER', date: '2024-06-01', currency: 'USD', fx_error: 'x' }),
      tx({ id: 'ignored', type: 'BUY', date: '2024-06-01', currency: 'USD', fx_error: 'x', ignored: true }),
    ])
    expect(issues.missingFx).toEqual([{ currency: 'USD', count: 2 }])
  })
  it('counts a 30-day buy-back after the year end once', () => {
    const sell = tx({ id: 'sell', date: '2025-04-01' })
    const buyBack = tx({ id: 'buy-back', type: 'BUY', date: '2025-04-20', currency: 'USD', fx_error: 'x', tax_year: '2025/26' })
    const m = matching(sell, 10, 0, '30_DAY')
    m.acquisitions = [{ transaction: buyBack, quantityMatched: 10, costBasisGbp: 0 }]
    const issues = findReportDataIssues(year, [record(sell, [m])], [sell, buyBack])
    expect(issues.missingFx).toEqual([{ currency: 'USD', count: 1 }])
  })

  it('does not double count a matched acquisition already inside the year', () => {
    const sell = tx({ id: 'sell', date: '2024-06-01' })
    const buy = tx({ id: 'buy', type: 'BUY', date: '2024-06-01', currency: 'USD', fx_error: 'x' })
    const m = matching(sell, 10, 0, 'SAME_DAY')
    m.acquisitions = [{ transaction: buy, quantityMatched: 10, costBasisGbp: 0 }]
    const issues = findReportDataIssues(year, [record(sell, [m])], [sell, buy])
    expect(issues.missingFx).toEqual([{ currency: 'USD', count: 1 }])
  })
})

describe('formatQuantity', () => {
  it('adds thousands separators and keeps up to 8 decimals', () => {
    expect(formatQuantity(1200)).toBe('1,200')
    expect(formatQuantity(0.0086629)).toBe('0.0086629')
    expect(formatQuantity(0.123456789)).toBe('0.12345679')
  })
})
