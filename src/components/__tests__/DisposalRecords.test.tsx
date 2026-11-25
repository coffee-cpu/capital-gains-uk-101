// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { DisposalRecords } from '../DisposalRecords'
import { useTransactionStore } from '../../stores/transactionStore'
import type { CGTCalculationResult, DisposalRecord } from '../../types/cgt'

// Tells React this environment supports act()
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function disposal(symbol: string, gainOrLossGbp: number, extra: Partial<DisposalRecord> = {}): DisposalRecord {
  return {
    id: `${symbol}-sell`,
    taxYear: '2024/25',
    gainOrLossGbp,
    proceedsGbp: 1000,
    allowableCostsGbp: 1000 - gainOrLossGbp,
    matchings: [],
    isIncomplete: false,
    disposal: { id: `${symbol}-sell`, symbol, date: '2024-06-03', quantity: 10, type: 'SELL', fee_gbp: 0, price_gbp: 100 },
    ...extra,
  } as unknown as DisposalRecord
}

let root: Root | null = null
let container: HTMLDivElement | null = null

function render(disposals: DisposalRecord[]): HTMLDivElement {
  useTransactionStore.setState({
    cgtResults: { disposals } as unknown as CGTCalculationResult,
    selectedTaxYear: '2024/25',
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(<DisposalRecords />))
  return container
}

/** The headline Gain/(Loss) figure of the first disposal */
function headline(el: HTMLElement): HTMLElement {
  const label = [...el.querySelectorAll('div')].find(d => d.textContent === 'Gain/(Loss)')!
  return label.nextElementSibling as HTMLElement
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  useTransactionStore.setState({ cgtResults: null })
})

describe('DisposalRecords', () => {
  it('shows a loss in brackets, in red', () => {
    const figure = headline(render([disposal('ACME', -181.25)]))
    expect(figure.textContent).toBe('(£181.25)')
    expect(figure.className).toContain('text-red-600')
  })

  it('shows a gain without brackets, in green', () => {
    const figure = headline(render([disposal('GLOBX', 209.62)]))
    expect(figure.textContent).toBe('£209.62')
    expect(figure.className).toContain('text-green-600')
  })

  it('shows £0.00 (e.g. nothing matched) neither red nor green', () => {
    const figure = headline(render([disposal('INITK', 0, { isIncomplete: true, unmatchedQuantity: 10 })]))
    expect(figure.textContent).toBe('£0.00')
    expect(figure.className).not.toMatch(/text-(red|green)/)
  })

  it('shows no stray 0 after the sale price when the fee is zero', () => {
    const el = render([disposal('ACME', -181.25)])
    act(() => el.querySelector('button')!.click())
    const salePrice = [...el.querySelectorAll('div')].find(d => d.textContent?.startsWith('Sale price:'))!
    expect(salePrice.textContent).toBe('Sale price: £100.00 per share')
  })
})
