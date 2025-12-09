import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('Revolut Import', () => {
  test('should import Revolut CSV successfully', async ({ page }) => {
    await page.goto('/')

    // Find the file input
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeVisible()

    // Upload the test CSV file
    const filePath = path.join(__dirname, 'fixtures', 'revolut-sample.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for success message
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Check that the success message shows transactions from Revolut
    await expect(page.getByText(/transactions from Revolut/i)).toBeVisible()

    // Verify transactions table is visible
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()

    // Check for some transaction data
    await expect(page.getByText('AAPL').first()).toBeVisible()
    await expect(page.getByText('Revolut').first()).toBeVisible()
  })
})
