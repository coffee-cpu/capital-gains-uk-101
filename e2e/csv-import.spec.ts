import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('CSV Import', () => {
  test('should import Schwab CSV successfully', async ({ page }) => {
    await page.goto('/')

    // Find the file input
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeVisible()

    // Upload the test CSV file
    const filePath = path.join(__dirname, 'fixtures', 'schwab-sample.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for success message
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Check that the success message shows the correct number of transactions
    await expect(page.getByText(/10 total transactions/i)).toBeVisible()

    // Verify transactions table is visible (exact match to avoid ambiguity)
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()

    // Check for some transaction data
    await expect(page.getByText('AAPL').first()).toBeVisible()
    await expect(page.getByText('MSFT').first()).toBeVisible()
    await expect(page.getByText('GOOGL').first()).toBeVisible()
  })

  test('should show error for invalid CSV', async ({ page }) => {
    await page.goto('/')

    // Create a temporary invalid CSV
    const fileInput = page.locator('input[type="file"]')

    // Upload a non-CSV file (use the index.html as a dummy)
    const invalidPath = path.join(__dirname, '..', 'index.html')
    await fileInput.setInputFiles(invalidPath)

    // Should show error
    await expect(page.getByText(/Import Error/i)).toBeVisible({ timeout: 10000 })
  })

  test('should display correct transaction details', async ({ page }) => {
    await page.goto('/')

    // Upload CSV
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'schwab-sample.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })

    // Check that transactions are displayed (use exact match to avoid ambiguity)
    await expect(page.getByText('10 total', { exact: true })).toBeVisible()

    // Check for BUY/SELL badges
    await expect(page.locator('.bg-green-100').first()).toBeVisible() // BUY badge
    await expect(page.locator('.bg-red-100').first()).toBeVisible() // SELL badge

    // Verify specific transaction symbols
    await expect(page.getByText('AAPL').first()).toBeVisible()
    await expect(page.getByText('Charles Schwab').first()).toBeVisible()
  })

  test('should import multiple CSV files successfully', async ({ page }) => {
    await page.goto('/')

    // Find the file input
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeVisible()

    // Upload multiple test CSV files
    const filePath1 = path.join(__dirname, 'fixtures', 'schwab-sample.csv')
    const filePath2 = path.join(__dirname, 'fixtures', 'generic-sample.csv')
    await fileInput.setInputFiles([filePath1, filePath2])

    // Wait for success message
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 15000 })

    // Check that the success message shows multiple files
    await expect(page.getByText(/2 file\(s\) imported successfully/i)).toBeVisible()

    // Verify transactions from both files are visible
    await expect(page.getByText('AAPL').first()).toBeVisible()
    await expect(page.getByText('Charles Schwab').first()).toBeVisible()
  })
})
