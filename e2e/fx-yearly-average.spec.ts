import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('HMRC Yearly Average FX Source', () => {
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

  test('should show error for pre-2020 transactions when using Yearly Average', async ({ page }) => {
    // Import pre-2020 transactions (will use default HMRC Monthly first)
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'fx-yearly-pre2020.csv')
    await fileInput.setInputFiles(filePath)
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Wait for transactions section to appear and scroll into view
    const transactionsHeading = page.getByRole('heading', { name: 'Transactions', exact: true })
    await transactionsHeading.scrollIntoViewIfNeeded()

    // Switch to HMRC Yearly Average - should show error
    const fxSelector = page.getByRole('button', { name: /HMRC Monthly Rates/i })
    await expect(fxSelector).toBeVisible({ timeout: 5000 })
    await fxSelector.click()
    await page.getByRole('button', { name: /HMRC Yearly Average/i }).click()

    // Should show FX Rate Error banner
    await expect(page.getByText(/FX Rate Error/i)).toBeVisible({ timeout: 15000 })

    // Transactions should show "Error" in GBP columns
    await expect(page.getByText('Error').first()).toBeVisible()
  })

  test('should work correctly for 2020-2024 transactions with Yearly Average', async ({ page }) => {
    // Import transactions from 2024 (should have yearly average data)
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'generic-sample.csv')
    await fileInput.setInputFiles(filePath)
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Switch to HMRC Yearly Average
    const fxSelector = page.getByRole('button', { name: /HMRC Monthly Rates/i })
    await fxSelector.click()
    await page.getByRole('button', { name: /HMRC Yearly Average/i }).click()

    // Wait for recalculation to complete
    await expect(page.getByRole('button', { name: /HMRC Yearly Average/i })).toBeVisible({ timeout: 15000 })

    // Should NOT show any error messages
    await expect(page.getByText(/not available/i)).not.toBeVisible()

    // Transactions should be visible with GBP values
    await expect(page.getByText('AAPL').first()).toBeVisible()
    await expect(page.getByText(/£\d+/).first()).toBeVisible()
  })
})
