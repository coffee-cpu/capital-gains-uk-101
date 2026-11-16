import { describe, it, expect } from 'vitest'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderCGTRateChange2024PDF } from '../pdfRenderers/cgtRateChange2024PDF'
import type { CGTRateChange2024Data } from '../cgtRateChange2024'
import type { PDFRenderContext } from '../types'

/** react-pdf primitives as plain tags, so the returned tree can be inspected */
const context = {
  Text: 'TEXT',
  View: 'VIEW',
  styles: {},
  formatCurrency: (value: number) => `£${value.toFixed(2)}`,
} as unknown as PDFRenderContext

function section(requiresAdjustment: boolean): ReactElement<{ wrap?: boolean; children?: ReactNode }> {
  const data = {
    featureId: 'cgt-rate-change-2024',
    requiresAdjustment,
    oldRates: { basic: 10, higher: 20 },
    newRates: { basic: 18, higher: 24 },
    gainsBeforeRateChange: 1000,
    lossesBeforeRateChange: 0,
    netGainOrLossBeforeRateChange: 1000,
    gainsAfterRateChange: 500,
    lossesAfterRateChange: 0,
    netGainOrLossAfterRateChange: 500,
  } as unknown as CGTRateChange2024Data
  const element = renderCGTRateChange2024PDF(data, context)
  if (!isValidElement(element)) throw new Error('expected an element')
  return element as ReactElement<{ wrap?: boolean; children?: ReactNode }>
}

describe('2024 CGT rate change PDF section', () => {
  it.each([true, false])('keeps the heading and box on one page (adjustment required: %s)', (requiresAdjustment) => {
    const root = section(requiresAdjustment)
    expect(root.type).toBe('VIEW')
    expect(root.props.wrap).toBe(false)

    const [heading, box] = Children.toArray(root.props.children) as ReactElement<{ children?: ReactNode }>[]
    expect(heading.type).toBe('TEXT')
    expect(heading.props.children).toBe('2024 CGT Rate Change — 30 October 2024')
    expect(box.type).toBe('VIEW')
  })
})
