// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CGTRateChange2024Panel } from '../CGTRateChange2024Panel'
import { renderCGTRateChange2024PDF } from '../../../lib/cgt/taxYearFeatures/pdfRenderers/cgtRateChange2024PDF'
import type { CGTRateChange2024Data } from '../../../lib/cgt/taxYearFeatures'
import type { PDFRenderContext } from '../../../lib/cgt/taxYearFeatures/types'
import { formatGbp } from '../../../utils/currency'

function makeData(totalNetGainOrLoss: number): CGTRateChange2024Data {
  return {
    featureId: 'cgt-rate-change-2024',
    rateChangeDate: '2024-10-30',
    oldRates: { basic: 10, higher: 20 },
    newRates: { basic: 18, higher: 24 },
    gainsBeforeRateChange: 0,
    lossesBeforeRateChange: 0,
    netGainOrLossBeforeRateChange: 0,
    disposalCountBeforeRateChange: 0,
    gainsAfterRateChange: 0,
    lossesAfterRateChange: 0,
    netGainOrLossAfterRateChange: totalNetGainOrLoss,
    disposalCountAfterRateChange: 1,
    requiresAdjustment: false,
    annualExemptAmount: 3000,
    totalNetGainOrLoss,
  }
}

const pdfContext = {
  Text: 'span',
  View: 'div',
  styles: {},
  formatCurrency: formatGbp,
} as unknown as PDFRenderContext

const renderPanel = (data: CGTRateChange2024Data) =>
  renderToStaticMarkup(<CGTRateChange2024Panel data={data} />).replace(/\s+/g, ' ')

const renderPdf = (data: CGTRateChange2024Data) =>
  renderToStaticMarkup(renderCGTRateChange2024PDF(data, pdfContext))

describe('2024 rate change message when no adjustment is required', () => {
  it('describes a net loss as a loss, in the panel', () => {
    const html = renderPanel(makeData(-1500))
    expect(html).toContain('You have a net loss of £1,500.00')
    expect(html).not.toContain('Your net gain')
    expect(html).not.toContain('(£1,500.00)')
  })

  it('describes a net loss as a loss, in the PDF', () => {
    const html = renderPdf(makeData(-1500))
    expect(html).toContain('Net loss of £1,500.00 for the year')
    expect(html).not.toContain('Net gain')
  })

  it('still compares a net gain with the Annual Exempt Amount', () => {
    expect(renderPanel(makeData(1500))).toContain('Your net gain (£1,500.00) is below')
    expect(renderPdf(makeData(1500))).toContain('Net gain (£1,500.00) is below')
  })
})

describe('2024 rate change breakdown when an adjustment is required', () => {
  const data: CGTRateChange2024Data = {
    ...makeData(10000),
    requiresAdjustment: true,
    gainsBeforeRateChange: 6000,
    netGainOrLossBeforeRateChange: 6000,
    disposalCountBeforeRateChange: 1,
    gainsAfterRateChange: 5234.56,
    lossesAfterRateChange: -1234.56,
    netGainOrLossAfterRateChange: 4000,
  }

  it('shows losses once in brackets, and no losses without brackets', () => {
    for (const html of [renderPanel(data), renderPdf(data)]) {
      expect(html).toContain('(£1,234.56)')
      expect(html).toContain('£0.00')
      expect(html).not.toContain('((£')
      expect(html).not.toContain('(£0.00)')
    }
  })
})
