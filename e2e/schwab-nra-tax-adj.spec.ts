import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('Schwab NRA Tax Adj Dividend Panel Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Clear IndexedDB before each test
    await page.goto('/')
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('cgt-visualizer')
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()
        req.onblocked = () => resolve()
      })
    })
    await page.reload()
  })

  test('should display correct dividend panel values with NRA Tax Adj withholding', async ({ page }) => {
    // Increase timeout for FX rate fetching
    test.setTimeout(60000)

    // Upload the Schwab NRA Tax Adj fixture
    // Contains: 1 BUY + 1 SELL (to trigger Tax Year Summary),
    // 1 AAPL dividend with NRA Tax Adj ($15.75 gross, $2.50 withheld),
    // 1 MSFT dividend without NRA Tax Adj ($22.50 gross)
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeVisible()

    const filePath = path.join(__dirname, 'fixtures', 'schwab-nra-tax-adj.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import to complete
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 45000 })

    // Wait for Tax Year Summary section to appear
    await expect(page.getByRole('heading', { name: 'Tax Year Summary' })).toBeVisible({ timeout: 10000 })

    // Ensure 2024/25 tax year is selected
    const taxYearSelect = page.locator('#tax-year-select')
    await expect(taxYearSelect).toBeVisible()
    await taxYearSelect.selectOption('2024/25')
    await page.waitForTimeout(500)

    // Verify the period is correct
    await expect(page.getByText('Period: 2024-04-06 to 2025-04-05')).toBeVisible()

    // --- Dividend Income Button ---
    const dividendButton = page.getByRole('button', { name: /Dividend Income/ })
    await expect(dividendButton).toBeVisible()

    // Verify dividend count shows 2 payments
    await expect(dividendButton).toContainText('2 payments')

    // Expand the dividend details panel
    await dividendButton.click()
    await page.waitForTimeout(300)

    // Scroll to ensure all dividend content is visible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(300)

    // --- Dividend Income Details ---
    await expect(page.getByRole('heading', { name: /Dividend Income Details/i })).toBeVisible()
    await expect(page.getByText(/Dividend tax is calculated separately from capital gains tax/i)).toBeVisible()

    // --- Dividend Calculation Section ---
    // Gross Dividends (taxable amount): £29.79
    // This is the sum of gross dividends for both AAPL ($15.75) and MSFT ($22.50) converted to GBP
    await expect(page.getByText('Gross Dividends (taxable amount)')).toBeVisible()
    await expect(page.getByText('£29.79').first()).toBeVisible()

    // Less: Dividend Allowance: (£500) for 2024/25
    await expect(page.getByText('Less: Dividend Allowance')).toBeVisible()
    await expect(page.getByText('(£500)')).toBeVisible()

    // Taxable Dividends: £0.00 (within £500 allowance)
    await expect(page.getByText('Taxable Dividends')).toBeVisible()

    // --- SA106 Foreign Income Summary ---
    await expect(page.getByText(/SA106 Foreign Income Summary/i)).toBeVisible()

    // Gross Dividends (before tax withheld): £29.79
    await expect(page.getByText('Gross Dividends (before tax withheld)')).toBeVisible()

    // Tax Withheld at Source: £1.92 (AAPL's $2.50 NRA Tax Adj converted to GBP)
    await expect(page.getByText('Tax Withheld at Source')).toBeVisible()
    await expect(page.getByText('£1.92')).toBeVisible()

    // Net Dividends Received: £27.87 (gross £29.79 - withheld £1.92)
    await expect(page.getByText('Net Dividends Received')).toBeVisible()
    await expect(page.getByText('£27.87')).toBeVisible()

    // --- Status: Within Dividend Allowance ---
    await expect(page.getByText(/Within Dividend Allowance/i)).toBeVisible()
    await expect(page.getByText(/No dividend tax is due/i)).toBeVisible()
  })
})
