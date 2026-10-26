import { test, expect, Page } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * HMRC worked examples, end to end.
 *
 * Each scenario imports a GBP-only fixture (no FX lookups needed) and checks
 * the figures the app shows against HMRC's published answer.
 *
 * Rounding: HMRC rounds every step of its worked examples to whole pounds;
 * the app keeps pence. Each expected figure below notes the HMRC equivalent.
 *
 * Source: HS284 Shares and Capital Gains Tax helpsheet
 * https://www.gov.uk/government/publications/shares-and-capital-gains-tax-hs284-self-assessment-helpsheet
 */

async function importFixture(page: Page, fixture: string) {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'fixtures', fixture))
  await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'Tax Year Summary' })).toBeVisible({ timeout: 10000 })
}

async function selectTaxYear(page: Page, taxYear: string) {
  await page.locator('#tax-year-select').selectOption(taxYear)
}

/** A label/value row in the tax year's "CGT Calculation" box */
function calculationRow(page: Page, label: string) {
  return page.locator('div.flex.justify-between').filter({ hasText: label }).first()
}

/** Expand the disposal list, then open the disposal for a symbol on a date */
async function openDisposal(page: Page, symbol: string, date: string) {
  const disposalsToggle = page.getByRole('button', { name: /Disposals/ })
  if (!(await page.getByText('Matched Acquisitions').first().isVisible().catch(() => false))) {
    await disposalsToggle.click()
  }
  const row = page.getByRole('button').filter({ hasText: symbol }).filter({ hasText: date })
  await row.click()
  return row.locator('..')
}

test.describe('HMRC HS284 Example 3 - Section 104 holding (Lobster plc)', () => {
  // HS284 Example 3 (figures identical across the 2023-2026 editions):
  //   Bought 1,000 shares at 400p + £150 costs   -> pool 1,000 shares, £4,150
  //   Bought   500 shares at 410p +  £80 costs   -> pool 1,500 shares, £6,280
  //   Sold 700 for £3,360, £100 costs: cost £6,280 × 700/1,500 = £2,931 (£2,930.67)
  //     gain £3,360 - £2,931 - £100 = £329 (app: £329.33)
  //   Pool 800 shares, £3,349 (£3,349.33)
  //   Sold 400 for £2,080, £105 costs: cost £3,349 × 400/800 = £1,675 (£1,674.67)
  //     gain £2,080 - £1,675 - £105 = £300 (app: £300.33)
  // The sale dates are illustrative (both placed in 2024/25); the
  // purchase dates follow the 2024/2025 editions.
  test.beforeEach(async ({ page }) => {
    await importFixture(page, 'hmrc-hs284-example3.csv')
    await selectTaxYear(page, '2024/25')
  })

  test('matches HMRC gain on the first sale (700 shares)', async ({ page }) => {
    const disposal = await openDisposal(page, 'LOBSTER', '2024-05-15')
    await expect(disposal.getByText('Section 104 Pool').first()).toBeVisible()
    await expect(disposal).toContainText('Less: Allowable costs:(£2930.67)')
    await expect(disposal).toContainText('Gain/(Loss):£329.33')
  })

  test('matches HMRC gain on the second sale (400 shares)', async ({ page }) => {
    const disposal = await openDisposal(page, 'LOBSTER', '2025-02-03')
    await expect(disposal).toContainText('Less: Allowable costs:(£1674.67)')
    await expect(disposal).toContainText('Gain/(Loss):£300.33')
  })

  test('totals the year as HMRC does (£329 + £300)', async ({ page }) => {
    await expect(calculationRow(page, 'Total Gains')).toContainText('£629.67')
    await expect(calculationRow(page, 'Total Losses')).toContainText('(£0.00)')
    await expect(calculationRow(page, 'Net Gain/(Loss)')).toContainText('£629.67')
  })
})

test.describe('HMRC HS284 Example 2 - 30-day rule (Mesopotamia plc)', () => {
  // HS284 Example 2 (2026 edition dates):
  //   Holds 9,500 shares in a Section 104 holding
  //   30 Aug 2025: sells 4,000 shares for £6,000
  //   11 Sep 2025: buys 500 shares for £850
  // HMRC matches 500 of the shares sold with the 11 Sep purchase (30-day
  // rule): proceeds 500/4,000 × £6,000 = £750, cost £850, loss £100.
  // The other 3,500 come from the Section 104 holding.
  //
  // HS284 does not give the holding's cost, so the fixture assumes £1.00 per
  // share: 3,500 × (£1.50 - £1.00) = £1,750 gain on the pooled part.
  // Disposal total: -£100 + £1,750 = £1,650.
  test.beforeEach(async ({ page }) => {
    await importFixture(page, 'hmrc-hs284-example2.csv')
    await selectTaxYear(page, '2025/26')
  })

  test('matches 500 shares to the repurchase within 30 days at HMRC cost (£850)', async ({ page }) => {
    const disposal = await openDisposal(page, 'MESOPOTAMIA', '2025-08-30')
    await expect(disposal.getByText('30-Day Rule')).toBeVisible()
    await expect(disposal).toContainText('2025-09-11: 500.00 shares at £1.70 (cost: £850.00)')
  })

  test('matches the remaining 3,500 shares from the Section 104 holding', async ({ page }) => {
    const disposal = await openDisposal(page, 'MESOPOTAMIA', '2025-08-30')
    await expect(disposal.getByText('Section 104 Pool')).toBeVisible()
    await expect(disposal).toContainText('3500.00 shares')
    await expect(disposal).toContainText('Less: Allowable costs:(£4350.00)')
  })

  test('includes HMRC\'s £100 loss on the 30-day part in the disposal total', async ({ page }) => {
    // (£750 - £850) + (£5,250 - £3,500) = £1,650
    await expect(calculationRow(page, 'Net Gain/(Loss)')).toContainText('£1,650.00')
  })
})

test.describe('Same-day rule - acquisitions on one day at average cost (TCGA92/S105(1))', () => {
  // Not an HMRC worked example: constructed from the rule in CG51560 /
  // TCGA92/S105(1), under which all shares acquired on one day are treated as
  // a single acquisition.
  //   1 Jun 2023: buy 10 at £100, buy 10 at £200, sell 10 at £150
  //   Day's average cost: £3,000 / 20 = £150, so the sale has no gain.
  // (First-in first-out would wrongly give a £500 gain.)
  // https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560
  test.beforeEach(async ({ page }) => {
    await importFixture(page, 'same-day-average-cost.csv')
    await selectTaxYear(page, '2023/24')
  })

  test('matches the sale against both purchases at the day\'s average cost', async ({ page }) => {
    const disposal = await openDisposal(page, 'SAMEDAY', '2023-06-01')
    await expect(disposal.getByText('Same Day')).toBeVisible()
    await expect(disposal).toContainText('2023-06-01: 5.00 shares at £100.00 (cost: £500.00)')
    await expect(disposal).toContainText('2023-06-01: 5.00 shares at £200.00 (cost: £1000.00)')
    await expect(disposal).toContainText('Less: Allowable costs:(£1500.00)')
    await expect(disposal).toContainText('Gain/(Loss):£0.00')
  })

  test('reports no gain for the year', async ({ page }) => {
    await expect(calculationRow(page, 'Total Gains')).toContainText('£0.00')
    await expect(calculationRow(page, 'Net Gain/(Loss)')).toContainText('£0.00')
  })
})
