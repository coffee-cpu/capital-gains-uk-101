import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('PDF Export and Tax Year Features (PR #36)', () => {
  /**
   * Tests the CGT Rate Change 2024 feature registry pattern:
   * - Feature appears for 2024/25 tax year (which has disposals after 30 Oct 2024)
   * - Feature does NOT appear for 2023/24 tax year (all disposals before rate change)
   */
  test('CGT Rate Change 2024 feature appears only for 2024/25 tax year', async ({ page }) => {
    // Increase timeout for FX rate fetching
    test.setTimeout(60000)

    await page.goto('/')

    // Wait for the page to be fully loaded (check for the drag-drop text)
    await expect(page.getByText('Drop your CSV files here')).toBeVisible({ timeout: 10000 })

    // Upload the generic example file (has transactions in both tax years)
    // Note: file input has opacity-0 but is still interactable
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, '..', 'public', 'examples', 'generic-example.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import to complete
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 45000 })

    // Wait for Tax Year Summary section
    await expect(page.getByRole('heading', { name: 'Tax Year Summary' })).toBeVisible({ timeout: 10000 })

    const taxYearSelect = page.locator('#tax-year-select')
    await expect(taxYearSelect).toBeVisible()

    // Test 1: Select 2023/24 - CGT Rate Change panel should NOT appear
    await taxYearSelect.selectOption('2023/24')
    await page.waitForTimeout(500)

    // The CGT rate change panel should NOT be visible for 2023/24
    const rateChangePanelFor2023 = page.getByText('2024 CGT Rate Change')
    await expect(rateChangePanelFor2023).not.toBeVisible()

    // Test 2: Select 2024/25 - CGT Rate Change panel SHOULD appear
    await taxYearSelect.selectOption('2024/25')
    await page.waitForTimeout(500)

    // The CGT rate change panel SHOULD be visible for 2024/25
    const rateChangePanelFor2024 = page.getByText('2024 CGT Rate Change')
    await expect(rateChangePanelFor2024).toBeVisible()

    // Verify the panel contains expected content (rate change info)
    // Since we have disposals after 30 Oct 2024 and net gain > £3,000,
    // the "Action Required" panel should appear
    const actionRequired = page.getByText('Action Required')
    const noAdjustment = page.getByText('No Adjustment Required')

    // One of these should be visible (depending on gain amount)
    const isActionRequired = await actionRequired.isVisible().catch(() => false)
    const isNoAdjustment = await noAdjustment.isVisible().catch(() => false)
    expect(isActionRequired || isNoAdjustment).toBe(true)

    // Verify HMRC link is present
    const hmrcLink = page.locator('a[href*="gov.uk/government/publications/changes-to-the-rates-of-capital-gains-tax"]')
    await expect(hmrcLink).toBeVisible()
  })

  /**
   * Tests PDF export functionality with tax year features:
   * - Export button is enabled when data is present
   * - Clicking export triggers download without errors
   * - Tests the abstracted PDF renderer registry pattern from PR #36
   */
  test('PDF export works correctly with tax year features', async ({ page }) => {
    // Increase timeout for FX rate fetching
    test.setTimeout(60000)

    await page.goto('/')

    // Wait for the page to be fully loaded
    await expect(page.getByText('Drop your CSV files here')).toBeVisible({ timeout: 10000 })

    // Upload the generic example file
    // Note: file input has opacity-0 but is still interactable
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, '..', 'public', 'examples', 'generic-example.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import to complete
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 45000 })

    // Wait for Tax Year Summary section
    await expect(page.getByRole('heading', { name: 'Tax Year Summary' })).toBeVisible({ timeout: 10000 })

    // Select 2024/25 which has the CGT rate change feature
    const taxYearSelect = page.locator('#tax-year-select')
    await expect(taxYearSelect).toBeVisible()
    await taxYearSelect.selectOption('2024/25')
    await page.waitForTimeout(500)

    // Verify CGT rate change panel is visible (feature is present)
    await expect(page.getByText('2024 CGT Rate Change')).toBeVisible()

    // Find and verify the Export PDF button
    const exportButton = page.getByRole('button', { name: /Export PDF/i })
    await expect(exportButton).toBeVisible()
    await expect(exportButton).toBeEnabled()

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })

    // Click the export button
    await exportButton.click()

    // Wait for the download to be triggered
    const download = await downloadPromise

    // Verify the download was triggered successfully
    expect(download).toBeTruthy()

    // Verify filename contains expected pattern (tax year and CGT)
    const filename = download.suggestedFilename()
    expect(filename).toMatch(/cgt.*2024.*25.*\.pdf/i)
  })
})
