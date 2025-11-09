import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('Network Request Deduplication', () => {
  test('should not make duplicate network requests across multiple CSV imports', async ({ page, context }) => {
    // Start with fresh browser context (no cached data)
    await context.clearCookies()

    // Track all network requests
    const requests = new Map<string, number>()

    page.on('request', (request) => {
      const url = request.url()
      // Only track external API requests (exclude localhost, static assets, etc.)
      if (!url.includes('localhost') && !url.includes('127.0.0.1') && !url.endsWith('.js') && !url.endsWith('.css')) {
        const count = requests.get(url) || 0
        requests.set(url, count + 1)
      }
    })

    await page.goto('/')

    // First import
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'schwab-sample.csv')
    await fileInput.setInputFiles(filePath)
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Wait for all requests to complete
    await page.waitForTimeout(2000)

    // Record the number of unique requests after first import
    const firstImportRequestCount = requests.size

    // Second import of the same file (should use cached data)
    await fileInput.setInputFiles(filePath)
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Wait for any potential requests
    await page.waitForTimeout(2000)

    // Check for duplicate requests
    const duplicates: string[] = []
    requests.forEach((count, url) => {
      if (count > 1) {
        duplicates.push(`${url} (requested ${count} times)`)
      }
    })

    // Assert no duplicates
    expect(duplicates, `Found duplicate network requests:\n${duplicates.join('\n')}`).toHaveLength(0)

    // Verify second import didn't make additional requests (used cache)
    const secondImportRequestCount = requests.size
    expect(secondImportRequestCount, 'Second import should use cached data (no new requests)').toBe(firstImportRequestCount)

    // Log summary for debugging
    console.log(`\nNetwork request summary:`)
    console.log(`  First import: ${firstImportRequestCount} unique external requests`)
    console.log(`  Second import: 0 new requests (all cached)`)
    console.log(`\nAll external requests made:`)
    requests.forEach((count, url) => {
      console.log(`  ${count}x ${url}`)
    })
  })
})
