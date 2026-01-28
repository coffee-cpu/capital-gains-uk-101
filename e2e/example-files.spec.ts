import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { getEnabledBrokerDefinitions } from '../src/config/brokers'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * E2E tests to verify all public example CSV files can be imported successfully.
 * Uses the broker registry as the source of truth for example files.
 *
 * This ensures that documentation examples stay in sync with the actual parser implementations.
 */

// Get all enabled brokers with their example files from the registry
const BROKER_EXAMPLES = getEnabledBrokerDefinitions().map(broker => ({
  file: broker.exampleFile,
  broker: broker.displayName,
}))

test.describe('Example Files Import', () => {
  // Test that each example file can be successfully imported
  for (const { file, broker } of BROKER_EXAMPLES) {
    const filename = path.basename(file)

    test(`${filename} should import successfully as ${broker}`, async ({ page }) => {
      await page.goto('/')

      // Find and verify file input is visible
      const fileInput = page.locator('input[type="file"]')
      await expect(fileInput).toBeVisible()

      // Upload the example file from public/examples
      const filePath = path.join(__dirname, '..', 'public', file)
      await fileInput.setInputFiles(filePath)

      // Wait for success message
      await expect(
        page.getByText(/file\(s\) imported successfully/i),
        `Should show success message for ${broker}`
      ).toBeVisible({ timeout: 15000 })

      // Verify the broker name is shown in the success message
      await expect(
        page.getByText(new RegExp(`from ${broker}`, 'i')),
        `Should show broker name "${broker}"`
      ).toBeVisible()

      // Verify transactions table is visible
      await expect(
        page.getByRole('heading', { name: 'Transactions', exact: true }),
        `Should show transactions table for ${broker}`
      ).toBeVisible()

      // Verify at least one transaction was imported (use .first() since count appears in multiple places)
      await expect(
        page.getByText(/\d+ total/i).first(),
        `Should show transaction count for ${broker}`
      ).toBeVisible()
    })
  }

  // Test uploading all example files together
  test('should import all example files together', async ({ page }) => {
    await page.goto('/')

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeVisible()

    // Upload all example files at once
    const filePaths = BROKER_EXAMPLES.map(({ file }) =>
      path.join(__dirname, '..', 'public', file)
    )
    await fileInput.setInputFiles(filePaths)

    // Wait for success message
    await expect(
      page.getByText(/file\(s\) imported successfully/i)
    ).toBeVisible({ timeout: 30000 })

    // Should show multiple files imported
    await expect(
      page.getByText(new RegExp(`${BROKER_EXAMPLES.length} file\\(s\\) imported successfully`, 'i'))
    ).toBeVisible()

    // Verify transactions table is visible
    await expect(
      page.getByRole('heading', { name: 'Transactions', exact: true })
    ).toBeVisible()
  })
})
