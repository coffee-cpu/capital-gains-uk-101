import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('NRA Tax Adjustment - Dividend Values in Tax Year Summary', () => {
  /**
   * Tests the end-to-end flow of dividend withholding tax through the full pipeline:
   *   Generic CSV Parser (with gross_dividend/withholding_tax columns)
   *   → FX Enrichment (GBP native, no conversion needed)
   *   → CGT Engine (accumulate into tax year summary)
   *   → UI (display in SA106 Foreign Income Summary)
   *
   * Fixture: schwab-nra-tax-adj.csv (Generic CSV format, GBP) contains:
   *   - BUY 100 AAPL @ £150 on 2024-01-15 (2023/24 tax year)
   *   - SELL 50 AAPL @ £160 on 2024-06-15 (2024/25 tax year)
   *   - DIVIDEND AAPL £21.25 net, gross £25.00, withholding £3.75 on 2024-09-15
   *
   * After parsing: 3 transactions (BUY, SELL, DIVIDEND with withholding)
   * All values in GBP — no FX rate dependency.
   */

  test('should display correct dividend values and SA106 section with exact GBP amounts', async ({ page }) => {
    await page.goto('/')

    // Upload the Generic CSV with dividend withholding data
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeVisible()

    const filePath = path.join(__dirname, 'fixtures', 'schwab-nra-tax-adj.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import to complete — 3 transactions (BUY, SELL, DIVIDEND)
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 30000 })
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
    const dividendButton = page.getByRole('button', { name: /Dividend Income/ })
    await expect(dividendButton).toBeVisible()
    await expect(dividendButton).toContainText('1 payment')

    // Expand the Dividend Income section
    await dividendButton.click()
    await page.waitForTimeout(300)

    // Verify Dividend Income Details section appears
    await expect(page.getByRole('heading', { name: /Dividend Income Details/i })).toBeVisible()

    // --- Dividend allowance section (purple) ---
    // Gross Dividends (taxable amount): £25.00
    await expect(page.getByText('Gross Dividends (taxable amount)')).toBeVisible()
    await expect(page.locator('.text-purple-900').filter({ hasText: '£25.00' }).first()).toBeVisible()

    // Dividend Allowance for 2024/25: £500
    await expect(page.getByText('Less: Dividend Allowance')).toBeVisible()

    // Taxable Dividends: £0.00 (£25 < £500 allowance)
    await expect(page.getByText('Taxable Dividends')).toBeVisible()
    await expect(page.locator('.text-green-700').filter({ hasText: '£0.00' }).first()).toBeVisible()

    // --- SA106 Foreign Income Summary section (amber) ---
    await expect(page.getByText('SA106 Foreign Income Summary')).toBeVisible()

    const sa106Section = page.locator('.bg-amber-50')

    // Gross Dividends (before tax withheld): £25.00
    await expect(sa106Section.getByText('Gross Dividends (before tax withheld)')).toBeVisible()
    await expect(sa106Section.locator('.text-amber-900').filter({ hasText: '£25.00' }).first()).toBeVisible()

    // Tax Withheld at Source: £3.75
    await expect(sa106Section.getByText('Tax Withheld at Source')).toBeVisible()
    await expect(sa106Section.locator('.text-amber-900').filter({ hasText: '£3.75' })).toBeVisible()

    // Net Dividends Received: £21.25 (= £25.00 - £3.75)
    await expect(sa106Section.getByText('Net Dividends Received')).toBeVisible()
    await expect(sa106Section.locator('.text-amber-900').filter({ hasText: '£21.25' })).toBeVisible()
  })
})
