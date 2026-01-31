import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('NRA Tax Adjustment - Dividend Values in Tax Year Summary', () => {
  /**
   * Tests the end-to-end flow of Schwab NRA Tax Adj through the full pipeline:
   *   Schwab Parser (merge NRA Tax Adj into dividend)
   *   → FX Enrichment (convert gross/withholding/net to GBP)
   *   → CGT Engine (accumulate into tax year summary)
   *   → UI (display in SA106 Foreign Income Summary)
   *
   * Fixture: schwab-nra-tax-adj.csv contains:
   *   - BUY 100 AAPL @ $170 on 02/15/2024 (2023/24 tax year)
   *   - SELL 50 AAPL @ $180 on 06/17/2024 (2024/25 tax year)
   *   - NRA Tax Adj AAPL -$3.75 on 09/16/2024 (merged into dividend)
   *   - Qualified Dividend AAPL $25.00 on 09/16/2024
   *
   * After parsing: 3 transactions (BUY, SELL, DIVIDEND with withholding)
   * Expected dividend: Gross $25.00, Withholding $3.75, Net $21.25
   */

  test('should merge NRA Tax Adj into dividend and show correct dividend count', async ({ page }) => {
    await page.goto('/')

    // Upload the Schwab CSV with NRA Tax Adj
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeVisible()

    const filePath = path.join(__dirname, 'fixtures', 'schwab-nra-tax-adj.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import to complete
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 30000 })

    // NRA Tax Adj should be merged into dividend - 3 transactions total (BUY, SELL, DIVIDEND)
    // If NRA Tax Adj were NOT merged, there would be 4 transactions
    await expect(page.getByText(/3 total transactions/i)).toBeVisible()

    // Wait for Tax Year Summary section to appear
    await expect(page.getByRole('heading', { name: 'Tax Year Summary' })).toBeVisible({ timeout: 10000 })

    // Select the 2024/25 tax year (SELL and DIVIDEND are in this tax year)
    const taxYearSelect = page.locator('#tax-year-select')
    await expect(taxYearSelect).toBeVisible()
    await taxYearSelect.selectOption('2024/25')
    await page.waitForTimeout(500)

    // Verify 1 disposal in the tax year
    await expect(page.getByRole('button', { name: /Disposals/ })).toContainText('1')

    // Verify the Dividend Income card shows exactly 1 payment
    // This confirms the NRA Tax Adj row was merged into the dividend, not counted separately
    const dividendButton = page.getByRole('button', { name: /Dividend Income/ })
    await expect(dividendButton).toBeVisible()
    await expect(dividendButton).toContainText('1 payment')

    // Expand the Dividend Income section
    await dividendButton.click()
    await page.waitForTimeout(300)

    // Verify Dividend Income Details section appears
    await expect(page.getByRole('heading', { name: /Dividend Income Details/i })).toBeVisible()

    // Verify dividend allowance is displayed
    await expect(page.getByText('Gross Dividends (taxable amount)')).toBeVisible()
    await expect(page.getByText('Less: Dividend Allowance')).toBeVisible()
    await expect(page.getByText('Taxable Dividends')).toBeVisible()

    // Verify the dividend transaction shows net total ($21.25 = $25.00 - $3.75) in the table
    // The Schwab parser sets total = net for dividends with NRA Tax Adj
    await expect(page.getByText('$21.25')).toBeVisible()
  })

  test('should display SA106 with correct gross, withholding, and net values when FX rates are available', async ({ page }) => {
    // This test requires FX rate fetching from Bank of England API.
    // It verifies that NRA Tax Adj withholding flows through:
    //   Parser → FX Enrichment → CGT Engine → SA106 UI
    test.setTimeout(60000)

    await page.goto('/')

    // Upload the Schwab CSV with NRA Tax Adj
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeVisible()

    const filePath = path.join(__dirname, 'fixtures', 'schwab-nra-tax-adj.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import to complete
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 30000 })

    // Wait for Tax Year Summary section to appear
    await expect(page.getByRole('heading', { name: 'Tax Year Summary' })).toBeVisible({ timeout: 10000 })

    // Select the 2024/25 tax year
    const taxYearSelect = page.locator('#tax-year-select')
    await expect(taxYearSelect).toBeVisible()
    await taxYearSelect.selectOption('2024/25')
    await page.waitForTimeout(500)

    // Check if FX rates were successfully fetched by looking for the error banner
    const fxErrorBanner = page.getByText('Failed to fetch exchange rates')
    const hasFxError = await fxErrorBanner.isVisible().catch(() => false)
    if (hasFxError) {
      test.skip(true, 'FX rates unavailable - Bank of England API not reachable')
    }

    // Click the Dividend Income card to expand it
    const dividendButton = page.getByRole('button', { name: /Dividend Income/ })
    await expect(dividendButton).toBeVisible()
    await dividendButton.click()
    await page.waitForTimeout(300)

    // Verify SA106 Foreign Income Summary section appears
    // This section only appears when grossDividendsGbp > 0 (i.e., FX conversion succeeded)
    await expect(page.getByText('SA106 Foreign Income Summary')).toBeVisible()

    // Verify all three SA106 value labels are present
    await expect(page.getByText('Gross Dividends (before tax withheld)')).toBeVisible()
    await expect(page.getByText('Tax Withheld at Source')).toBeVisible()
    await expect(page.getByText('Net Dividends Received')).toBeVisible()

    // Extract the numeric GBP values from the SA106 section (amber background)
    const sa106Section = page.locator('.bg-amber-50')
    const sa106Text = await sa106Section.textContent()

    // Parse all £X.XX values from the SA106 section
    const gbpValues = sa106Text?.match(/£([\d,]+\.\d{2})/g)?.map(v =>
      parseFloat(v.replace('£', '').replace(/,/g, ''))
    ) ?? []

    // Should have exactly 3 values: Gross, Withholding, Net
    expect(gbpValues).toHaveLength(3)

    const [grossGbp, withholdingGbp, netGbp] = gbpValues

    // Gross dividend should be > 0
    expect(grossGbp).toBeGreaterThan(0)

    // Withholding tax should be > 0 (proves NRA Tax Adj was processed through the full pipeline)
    expect(withholdingGbp).toBeGreaterThan(0)

    // Net dividend should be > 0
    expect(netGbp).toBeGreaterThan(0)

    // Net should equal Gross - Withholding (within rounding tolerance)
    expect(netGbp).toBeCloseTo(grossGbp - withholdingGbp, 1)

    // Gross should be greater than Net (since withholding was deducted)
    expect(grossGbp).toBeGreaterThan(netGbp)

    // FX conversion preserves the ratio between withholding and gross
    // Original: $3.75 / $25.00 = 15%
    // GBP values use the same FX rate (same date), so the ratio is preserved exactly
    const withholdingRatio = withholdingGbp / grossGbp
    expect(withholdingRatio).toBeCloseTo(0.15, 2)
  })
})
