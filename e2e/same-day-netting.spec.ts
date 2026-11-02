import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Same-day sales of one share are a single disposal with one net gain or loss
 * (TCGA92/S105(1)(a)). A £50 loss and a £50 gain on the same day net to nil,
 * and every panel must agree with the year summary.
 */
test.describe('Same-day sales netted into one disposal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'fixtures', 'same-day-gain-and-loss.csv'))
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Tax Year Summary' })).toBeVisible({ timeout: 10000 })
    await page.locator('#tax-year-select').selectOption('2024/25')
  })

  test('the disposal records panel counts and totals them as the year summary does', async ({ page }) => {
    const disposalsTile = page.getByRole('button', { name: /Disposals/ })
    await expect(disposalsTile).toContainText('1')
    await expect(disposalsTile).toContainText('2 sales')

    await disposalsTile.click()
    // The heading sits in the panel's header; its grandparent is the whole panel
    const panel = page.getByRole('heading', { name: 'Disposal Records' }).locator('xpath=ancestor::div[2]')
    await expect(panel).toContainText('1 disposal (2 sales) in 2024/25')
    await expect(panel).toContainText(/Total Gains\s*£0\.00/)
    await expect(panel).toContainText(/Total Losses\s*£0\.00/)
  })
})
