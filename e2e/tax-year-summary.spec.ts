import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('Tax Year Summary Verification', () => {
  test('should auto-select most recent tax year on load', async ({ page }) => {
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

    // Verify the most recent tax year is auto-selected
    const taxYearSelect = page.locator('#tax-year-select')
    await expect(taxYearSelect).toBeVisible()
    const selectedValue = await taxYearSelect.inputValue()

    // Get all available tax years and verify the selected one is the most recent
    const allOptions = await taxYearSelect.locator('option').allTextContents()
    const sortedOptions = [...allOptions].sort((a, b) => b.localeCompare(a))
    expect(selectedValue).toBe(sortedOptions[0])

    // Verify Disposal Records section shows data (not "No disposals" message)
    // Click disposals button to expand
    await page.getByRole('button', { name: /Disposals/ }).click()
    await page.waitForTimeout(300)

    // Should show disposal records, not empty state
    const emptyState = page.getByText(/No share disposals recorded/i)
    await expect(emptyState).not.toBeVisible()

    // Verify export button is enabled
    const exportButton = page.getByRole('button', { name: /Export PDF/i })
    await expect(exportButton).toBeVisible()
    await expect(exportButton).toBeEnabled()
  })

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
    // Increase timeout for FX rate fetching with larger file (56 transactions)
    test.setTimeout(60000)

    await page.goto('/')

    // Upload the public generic example file
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeVisible()

    const filePath = path.join(__dirname, '..', 'public', 'examples', 'generic-example.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import to complete - longer timeout for FX rate fetching
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 45000 })

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
    // - 30-day bed-and-breakfast rules (including multiple same-day SELLs with INTC)
    // - Section 104 pooling
    // - Annual exemption deduction (£3,000 for 2024/25)

    // Verify the expected Taxable Gain value for 2024/25
    // This value is calculated with:
    // - Stock splits applied (AAPL 4:1, TSLA 3:1, NVDA 10:1, AMZN 20:1)
    // - Same-day matching (e.g., AAPL 2024-03-10, NVDA 2024-10-01, TSLA 2024-05-10)
    // - 30-day bed-and-breakfast (e.g., AAPL 2024-03-25, TSLA 2024-06-20, INTC 2024-11-01/15)
    // - Section 104 pooling for remaining shares
    // - Annual exemption (£3,000) deducted
    await expect(page.getByText('£7,509.07')).toBeVisible()
  })

  test('should display dividend income summary when dividends are present', async ({ page }) => {
    // Increase timeout for FX rate fetching with larger file (56 transactions)
    test.setTimeout(60000)

    await page.goto('/')

    // Upload the public generic example file (contains dividends)
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeVisible()

    const filePath = path.join(__dirname, '..', 'public', 'examples', 'generic-example.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import to complete - longer timeout for FX rate fetching
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 45000 })

    // Wait for Tax Year Summary section to appear
    await expect(page.getByRole('heading', { name: 'Tax Year Summary' })).toBeVisible({ timeout: 10000 })

    // Select the 2024/25 tax year (which has dividends)
    const taxYearSelect = page.locator('#tax-year-select')
    await expect(taxYearSelect).toBeVisible()
    await taxYearSelect.selectOption('2024/25')

    // Wait for summary to update
    await page.waitForTimeout(500)

    // Click the dividend card to expand it
    await page.getByRole('button', { name: /Dividend Income/ }).click()
    await page.waitForTimeout(300)

    // Verify Dividend Income details section appears
    await expect(page.getByRole('heading', { name: /Dividend Income Details/i })).toBeVisible()

    // Verify the section explains that dividend tax is separate
    await expect(page.getByText(/Dividend tax is calculated separately from capital gains tax/i)).toBeVisible()

    // Verify dividend allowance link is present (find the link to gov.uk/tax-on-dividends)
    await expect(page.getByRole('link', { name: '(source)' }).filter({ hasText: /source/ }).first()).toBeVisible()
    const dividendLink = page.locator('a[href="https://www.gov.uk/tax-on-dividends"]')
    await expect(dividendLink).toBeVisible()

    // Verify Taxable Dividends value is displayed
    await expect(page.getByText('Taxable Dividends')).toBeVisible()

    // Verify reporting guidance appears (either within allowance or exceeds)
    const withinAllowance = page.getByText(/Within Dividend Allowance/i)
    const reportingRequired = page.getByText(/Dividend Reporting Required/i)

    // One of these should be visible
    const isWithinAllowance = await withinAllowance.isVisible().catch(() => false)
    const isReportingRequired = await reportingRequired.isVisible().catch(() => false)

    expect(isWithinAllowance || isReportingRequired).toBe(true)
  })

  test('should show different dividend allowances for different tax years', async ({ page }) => {
    // Increase timeout for FX rate fetching with larger file (56 transactions)
    test.setTimeout(60000)

    await page.goto('/')

    // Upload the generic example file
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, '..', 'public', 'examples', 'generic-example.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import - longer timeout for FX rate fetching
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 45000 })

    // Wait for Tax Year Summary section
    await expect(page.getByRole('heading', { name: 'Tax Year Summary' })).toBeVisible({ timeout: 10000 })

    // Test 2023/24 tax year (£1,000 allowance)
    const taxYearSelect = page.locator('#tax-year-select')
    await taxYearSelect.selectOption('2023/24')
    await page.waitForTimeout(500)

    // Check if dividend card button is visible for 2023/24
    const dividendButton2023 = page.getByRole('button', { name: /Dividend Income/ })
    if (await dividendButton2023.isVisible()) {
      // Click to expand dividend details
      await dividendButton2023.click()
      await page.waitForTimeout(300)

      // Verify £1,000 allowance is mentioned
      await expect(page.getByText(/£1,000/i).first()).toBeVisible()

      // Collapse it again for next test
      await dividendButton2023.click()
      await page.waitForTimeout(300)
    }

    // Test 2024/25 tax year (£500 allowance)
    await taxYearSelect.selectOption('2024/25')
    await page.waitForTimeout(500)

    // Check if dividend card button is visible for 2024/25
    const dividendButton2024 = page.getByRole('button', { name: /Dividend Income/ })
    if (await dividendButton2024.isVisible()) {
      // Click to expand dividend details
      await dividendButton2024.click()
      await page.waitForTimeout(300)

      // Verify £500 allowance is mentioned
      await expect(page.getByText(/£500/i).first()).toBeVisible()
    }
  })
})
