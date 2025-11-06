import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('Tax Year Summary Verification', () => {
  test('should calculate correct CGT summary for 2023/24 tax year', async ({ page }) => {
    await page.goto('/')

    // Upload the test CSV file
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeVisible()

    const filePath = path.join(__dirname, 'fixtures', 'generic-multi-company.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import to complete
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 15000 })

    // Wait for Tax Year Summary section to appear
    await expect(page.getByRole('heading', { name: 'Tax Year Summary' })).toBeVisible({ timeout: 10000 })

    // Select the 2023/24 tax year from dropdown
    const taxYearSelect = page.locator('#tax-year-select')
    await expect(taxYearSelect).toBeVisible()
    await taxYearSelect.selectOption('2023/24')

    // Wait a moment for the summary to update
    await page.waitForTimeout(500)

    // Verify the period is correct
    await expect(page.getByText('Period: 2023-04-06 to 2024-04-05')).toBeVisible()

    // Verify the numerical values displayed on the page
    // Expected values for 2023/24 based on anonymized data:
    // - Disposals: 4
    // - Total Proceeds: £42,150
    // - Gains: £13,567
    // - Losses: £0
    // - Taxable Gain: £7,566.78

    // Check that all expected values are visible on the page
    await expect(page.getByRole('button', { name: /Disposals/ })).toContainText('4')
    await expect(page.getByText('£42,150')).toBeVisible()
    await expect(page.getByText('£13,567')).toBeVisible()
    await expect(page.getByText('£7,566.78')).toBeVisible()
  })

  test('should handle multiple tax years correctly', async ({ page }) => {
    await page.goto('/')

    // Upload the test CSV file
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'generic-multi-company.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 15000 })

    // Wait for Tax Year Summary section
    await expect(page.getByRole('heading', { name: 'Tax Year Summary' })).toBeVisible({ timeout: 10000 })

    // Check that the tax year dropdown has multiple options
    const taxYearSelect = page.locator('#tax-year-select')
    const options = await taxYearSelect.locator('option').count()
    expect(options).toBeGreaterThan(1)

    // Verify we can switch between tax years
    const taxYearOptions = await taxYearSelect.locator('option').allTextContents()
    console.log('Available tax years:', taxYearOptions)

    // Test switching between tax years
    for (const taxYear of taxYearOptions) {
      await taxYearSelect.selectOption(taxYear)
      await page.waitForTimeout(300)

      // Verify the summary updates with the correct period
      await expect(page.getByText(/Period:/)).toBeVisible()

      // Verify disposals count is visible
      await expect(page.getByRole('button', { name: /Disposals/ })).toBeVisible()

      console.log(`Switched to tax year: ${taxYear}`)
    }
  })

  test('should calculate correct taxable gain with generic-example.csv', async ({ page }) => {
    await page.goto('/')

    // Upload the public generic example file
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeVisible()

    const filePath = path.join(__dirname, '..', 'public', 'examples', 'generic-example.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import to complete
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 15000 })

    // Wait for Tax Year Summary section to appear
    await expect(page.getByRole('heading', { name: 'Tax Year Summary' })).toBeVisible({ timeout: 10000 })

    // Select the 2024/25 tax year
    const taxYearSelect = page.locator('#tax-year-select')
    await expect(taxYearSelect).toBeVisible()
    await taxYearSelect.selectOption('2024/25')

    // Wait for summary to update
    await page.waitForTimeout(500)

    // Verify the period is correct
    await expect(page.getByText('Period: 2024-04-06 to 2025-04-05')).toBeVisible()

    // Verify Taxable Gain value is displayed and calculated correctly
    // This test verifies that taxable gain calculation works end-to-end with:
    // - Stock splits (AAPL 4:1, TSLA 3:1, NVDA 10:1, AMZN 20:1)
    // - Same-day matching rules
    // - 30-day bed-and-breakfast rules
    // - Section 104 pooling
    // - Annual exemption deduction (£3,000 for 2024/25)

    // Verify the expected Taxable Gain value for 2024/25
    // This value is calculated with:
    // - Stock splits applied (AAPL 4:1, TSLA 3:1, NVDA 10:1, AMZN 20:1)
    // - Same-day matching (e.g., AAPL 2024-03-10, NVDA 2024-10-01, TSLA 2024-05-10)
    // - 30-day bed-and-breakfast (e.g., AAPL 2024-03-25, TSLA 2024-06-20)
    // - Section 104 pooling for remaining shares
    // - Annual exemption (£3,000) deducted
    await expect(page.getByText('£7,256.83')).toBeVisible()
  })
})
