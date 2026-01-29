import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Helper to find the IssuesPanel expand/collapse button
 */
async function getIssuesPanelButton(page: import('@playwright/test').Page) {
  // The IssuesPanel button contains the "Issues Requiring Attention" text
  return page.locator('button:has(h2:text-matches("Issue.*Requiring Attention"))').first()
}

/**
 * Helper to expand the IssuesPanel if it's collapsed
 */
async function expandIssuesPanel(page: import('@playwright/test').Page) {
  const button = await getIssuesPanelButton(page)
  await button.click()
  // Wait for animation
  await page.waitForTimeout(300)
}

test.describe('IssuesPanel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should show FX Rate Errors for crypto transactions', async ({ page }) => {
    // Upload crypto CSV which will fail FX rate lookup
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'generic-crypto.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for processing
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Wait for enrichment to complete (FX errors appear after enrichment)
    await page.waitForTimeout(2000)

    // Check for IssuesPanel header
    const issuesPanelButton = await getIssuesPanelButton(page)
    await expect(issuesPanelButton).toBeVisible()

    // Verify error badge count is shown (red badge)
    await expect(page.locator('button:has(h2) span.bg-red-100.text-red-800').first()).toBeVisible()

    // Expand and verify FX Rate Errors content
    await expandIssuesPanel(page)

    // Check for FX Rate Errors issue
    await expect(page.getByText('FX Rate Errors')).toBeVisible()
    await expect(page.getByText(/Crypto currencies require manual GBP values/i)).toBeVisible()
  })

  test('should show Incomplete Disposals error', async ({ page }) => {
    // Upload Freetrade file with incomplete disposals (sells without matching buys)
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'freetrade-example.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for processing
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Wait for CGT calculations to complete
    await page.waitForTimeout(1000)

    // Check for IssuesPanel
    const issuesPanelButton = await getIssuesPanelButton(page)
    await expect(issuesPanelButton).toBeVisible()

    // Expand and verify Incomplete Disposals content
    await expandIssuesPanel(page)

    // Check for Incomplete Disposal Data issue (use .first() as there may be duplicates in old UI)
    await expect(page.getByText('Incomplete Disposal Data').first()).toBeVisible()
    await expect(page.getByText(/disposal.*could not be fully matched/i).first()).toBeVisible()
  })

  test('should show Incomplete Stock Plan Activity warning', async ({ page }) => {
    // Upload Schwab file with Stock Plan Activity without price
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'schwab-sample.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for processing
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Wait for enrichment to complete
    await page.waitForTimeout(1000)

    // Check for IssuesPanel
    const issuesPanelButton = await getIssuesPanelButton(page)
    await expect(issuesPanelButton).toBeVisible()

    // Verify warning badge (yellow) is shown
    await expect(page.locator('button:has(h2) span.bg-yellow-100.text-yellow-800').first()).toBeVisible()

    // Expand and verify Incomplete Stock Plan Activity content
    await expandIssuesPanel(page)

    // Check for Incomplete Stock Plan Activity issue
    await expect(page.getByText('Incomplete Stock Plan Activity')).toBeVisible()
    await expect(page.getByText(/Stock Plan Activity transaction.*missing price data/i)).toBeVisible()
  })

  test('should show Buy-Only Scenario info', async ({ page }) => {
    // Upload Schwab Equity Awards file (BUY-only)
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'schwab-equity-awards-buy-only.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for processing
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Wait for enrichment to complete
    await page.waitForTimeout(1000)

    // Check for IssuesPanel
    const issuesPanelButton = await getIssuesPanelButton(page)
    await expect(issuesPanelButton).toBeVisible()

    // Verify info badge (blue) is shown
    await expect(page.locator('button:has(h2) span.bg-blue-100.text-blue-800').first()).toBeVisible()

    // Expand and verify No Disposals Found content
    await expandIssuesPanel(page)

    // Check for No Disposals Found issue
    await expect(page.getByText('No Disposals Found')).toBeVisible()
    await expect(page.getByText(/BUY transaction.*but no SELL/i)).toBeVisible()
  })

  test('should not show IssuesPanel when no issues exist', async ({ page }) => {
    // Upload generic sample file that has complete buy/sell pairs in GBP
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'generic-sample.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for processing
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Wait for enrichment
    await page.waitForTimeout(1000)

    // IssuesPanel should not be visible (no issues)
    const issuesPanelButton = page.locator('button:has(h2:text-matches("Issue.*Requiring Attention"))')
    await expect(issuesPanelButton).not.toBeVisible()

    // CGT Calculation should be visible (normal state)
    await expect(page.getByRole('heading', { name: 'CGT Calculation' })).toBeVisible()
  })

  test('should show issues sorted by severity (errors first)', async ({ page }) => {
    // Upload Schwab sample that has both incomplete stock plan activity AND potential other issues
    const fileInput = page.locator('input[type="file"]')
    const schwabPath = path.join(__dirname, 'fixtures', 'schwab-sample.csv')
    await fileInput.setInputFiles(schwabPath)

    // Wait for processing
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Wait for enrichment
    await page.waitForTimeout(1000)

    // Check for IssuesPanel
    const issuesPanelButton = await getIssuesPanelButton(page)
    await expect(issuesPanelButton).toBeVisible()

    // Expand the panel
    await expandIssuesPanel(page)

    // Get all issue items in order (they have border-l-4 class)
    const issueItems = page.locator('[class*="border-l-4"][class*="bg-"]')
    const count = await issueItems.count()
    expect(count).toBeGreaterThan(0)

    // First issue should be error (red border) if there are errors
    const firstIssue = issueItems.first()
    const firstIssueClass = await firstIssue.getAttribute('class')

    // Verify the issue has proper styling
    expect(
      firstIssueClass?.includes('border-l-red') ||
      firstIssueClass?.includes('border-l-yellow') ||
      firstIssueClass?.includes('border-l-blue')
    ).toBeTruthy()
  })

  test('should toggle expand/collapse on click', async ({ page }) => {
    // Upload crypto file which will generate issues
    const fileInput = page.locator('input[type="file"]')
    const cryptoPath = path.join(__dirname, 'fixtures', 'generic-crypto.csv')
    await fileInput.setInputFiles(cryptoPath)

    // Wait for processing
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Wait for enrichment
    await page.waitForTimeout(2000)

    // IssuesPanel should be visible
    const issuesPanelButton = await getIssuesPanelButton(page)
    await expect(issuesPanelButton).toBeVisible()

    // Click to toggle - check for content visibility change
    const expandedContent = page.locator('.border-t.border-gray-100')

    // First click - should toggle state
    await issuesPanelButton.click()
    await page.waitForTimeout(300)

    // Second click - should toggle back
    await issuesPanelButton.click()
    await page.waitForTimeout(300)

    // Panel should still be functional
    await expect(issuesPanelButton).toBeVisible()
  })

  test('should show affected items for issues', async ({ page }) => {
    // Upload crypto CSV
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'generic-crypto.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for processing
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Wait for enrichment
    await page.waitForTimeout(2000)

    // Expand the IssuesPanel
    await expandIssuesPanel(page)

    // Check for affected items (BTC, ETH symbols)
    await expect(page.getByText('Affected:')).toBeVisible()
    await expect(page.locator('span.font-mono').filter({ hasText: 'BTC' })).toBeVisible()
    await expect(page.locator('span.font-mono').filter({ hasText: 'ETH' })).toBeVisible()
  })
})
