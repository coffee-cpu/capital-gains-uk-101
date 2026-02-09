import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Mock CDN data for TSLA splits */
function tslaSplitData(year: number) {
  if (year === 2020) {
    return {
      year: 2020,
      updated: '2024-01-01',
      splits: [
        {
          symbol: 'TSLA',
          name: 'Tesla Inc.',
          date: '2020-08-31',
          ratio: '5:1',
          exchange: 'NASDAQ',
          source: 'https://example.com',
          notes: '5-for-1 forward split',
        },
      ],
    }
  }
  if (year === 2022) {
    return {
      year: 2022,
      updated: '2024-01-01',
      splits: [
        {
          symbol: 'TSLA',
          name: 'Tesla Inc.',
          date: '2022-08-24',
          ratio: '3:1',
          exchange: 'NASDAQ',
          source: 'https://example.com',
          notes: '3-for-1 forward split',
        },
      ],
    }
  }
  // Other years: no splits
  return { year, updated: '2024-01-01', splits: [] }
}

/** Set up route interception for jsDelivr CDN split data */
async function mockCdnSplits(page: import('@playwright/test').Page) {
  await page.route('**/cdn.jsdelivr.net/gh/coffee-cpu/stock-splits-data@main/data/*.json', (route) => {
    const url = route.request().url()
    const yearMatch = url.match(/(\d{4})\.json/)
    const year = yearMatch ? parseInt(yearMatch[1]) : 0
    const data = tslaSplitData(year)

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    })
  })
}

/** Set up route interception that returns errors for all CDN requests */
async function mockCdnFailure(page: import('@playwright/test').Page) {
  await page.route('**/cdn.jsdelivr.net/gh/coffee-cpu/stock-splits-data@main/data/*.json', (route) => {
    route.abort('failed')
  })
}

test.describe('Auto-detected Stock Splits', () => {
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

  test('should auto-detect and apply splits for transactions without broker splits', async ({ page }) => {
    await mockCdnSplits(page)

    // Import TSLA CSV without broker splits
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'auto-splits-tsla.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 15000 })

    // Wait for transactions to appear
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible({ timeout: 10000 })

    // Should have 4 rows: BUY + 2 auto STOCK_SPLITs + SELL
    await expect(page.getByText('4 total', { exact: true })).toBeVisible({ timeout: 5000 })

    // Verify auto-detected splits appear with "Auto-detected" source and "Auto" badge
    const autoSplitRows = page.locator('tr').filter({ hasText: 'STOCK_SPLIT' }).filter({ hasText: 'Auto-detected' })
    await expect(autoSplitRows).toHaveCount(2)

    // Check for "Auto" badge (span with bg-teal-100 class)
    const autoBadges = page.locator('span.bg-teal-100').filter({ hasText: 'Auto' })
    await expect(autoBadges).toHaveCount(2)

    // Verify split ratios are shown
    await expect(page.getByText('5:1').first()).toBeVisible()
    await expect(page.getByText('3:1').first()).toBeVisible()

    // The BUY of 1 share should show split-adjusted quantity of 15 (1 × 5 × 3)
    const buyRow = page.locator('tr').filter({ hasText: 'BUY' }).filter({ hasText: '2019-01-02' })
    await expect(buyRow).toBeVisible()
    const splitBadge = buyRow.locator('[class*="bg-purple-50"]').first()
    await expect(splitBadge).toBeVisible()
    // The split-adjusted quantity badge should show 15
    await expect(buyRow.getByText('15', { exact: true })).toBeVisible()

    // SELL should NOT have an Incomplete badge (splits properly applied)
    const sellRow = page.locator('tr').filter({ hasText: 'SELL' }).filter({ hasText: '2025-06-15' })
    await expect(sellRow).toBeVisible()
    const incompleteBadge = sellRow.locator('.bg-red-100.text-red-800').filter({ hasText: 'Incomplete' })
    await expect(incompleteBadge).toHaveCount(0)
  })

  test('should not duplicate splits when broker already provides them', async ({ page }) => {
    await mockCdnSplits(page)

    // Import TSLA CSV that already has the 5:1 broker split
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'auto-splits-tsla-with-broker-split.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible({ timeout: 10000 })

    // Should have 4 rows: BUY + 1 broker STOCK_SPLIT + 1 auto STOCK_SPLIT + SELL
    await expect(page.getByText('4 total', { exact: true })).toBeVisible({ timeout: 5000 })

    // Only 1 auto-detected split (3:1), the 5:1 is broker-provided
    const autoSplitRows = page.locator('tr').filter({ hasText: 'STOCK_SPLIT' }).filter({ hasText: 'Auto-detected' })
    await expect(autoSplitRows).toHaveCount(1)

    // The broker split should still show "Generic CSV" source (not Auto-detected)
    const brokerSplitRow = page.locator('tr').filter({ hasText: 'STOCK_SPLIT' }).filter({ hasText: '2020-08-31' })
    await expect(brokerSplitRow).toBeVisible()
    await expect(brokerSplitRow.getByText('Generic CSV')).toBeVisible()

    // Auto-detected 3:1 should show
    const autoSplitRow = page.locator('tr').filter({ hasText: 'STOCK_SPLIT' }).filter({ hasText: '2022-08-24' })
    await expect(autoSplitRow).toBeVisible()
    await expect(autoSplitRow.getByText('Auto-detected')).toBeVisible()
  })

  test('should not show auto-splits when toggle is disabled', async ({ page }) => {
    await mockCdnSplits(page)

    // Import TSLA CSV
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'auto-splits-tsla.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import (auto-splits should be applied)
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('4 total', { exact: true })).toBeVisible({ timeout: 5000 })

    // Now disable auto-splits toggle
    const autoSplitsToggle = page.getByRole('switch', { name: /auto-splits/i }).or(page.locator('button[role="switch"]'))
    await autoSplitsToggle.click()

    // Wait for recalculation
    await expect(page.getByText('2 total', { exact: true })).toBeVisible({ timeout: 15000 })

    // No STOCK_SPLIT rows should be visible
    const stockSplitRows = page.locator('tr').filter({ hasText: 'STOCK_SPLIT' })
    await expect(stockSplitRows).toHaveCount(0)

    // SELL should show Incomplete badge (no splits applied)
    const sellRow = page.locator('tr').filter({ hasText: 'SELL' }).filter({ hasText: '2025-06-15' })
    await expect(sellRow).toBeVisible()
    const incompleteBadge = sellRow.locator('.bg-red-100.text-red-800').filter({ hasText: 'Incomplete' })
    await expect(incompleteBadge).toBeVisible()
  })

  test('should handle CDN failure gracefully', async ({ page }) => {
    await mockCdnFailure(page)

    // Import TSLA CSV
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'auto-splits-tsla.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import — should succeed despite CDN failure
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible({ timeout: 10000 })

    // Only BUY + SELL (no auto-splits)
    await expect(page.getByText('2 total', { exact: true })).toBeVisible({ timeout: 5000 })

    // No STOCK_SPLIT rows
    const stockSplitRows = page.locator('tr').filter({ hasText: 'STOCK_SPLIT' })
    await expect(stockSplitRows).toHaveCount(0)

    // SELL should show Incomplete badge
    const sellRow = page.locator('tr').filter({ hasText: 'SELL' }).filter({ hasText: '2025-06-15' })
    await expect(sellRow).toBeVisible()
    const incompleteBadge = sellRow.locator('.bg-red-100.text-red-800').filter({ hasText: 'Incomplete' })
    await expect(incompleteBadge).toBeVisible()
  })
})
