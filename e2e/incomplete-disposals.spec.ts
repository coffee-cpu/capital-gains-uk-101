import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Expand the Issues panel (collapsed on each page load) and return its "Incomplete Disposal Data" entry */
async function incompleteDisposalsIssue(page: import('@playwright/test').Page) {
  await page.locator('button:has(h2:text-matches("Issue.*Requiring Attention"))').first().click()
  return page.locator('div', { has: page.getByText('Incomplete Disposal Data', { exact: true }) })
    .filter({ hasText: 'could not be fully matched' }).last()
}

test.describe('Incomplete Disposal Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Upload the Freetrade example CSV which has incomplete disposals
    const fileInput = page.locator('input[type="file"]')
    const filePath = path.join(__dirname, 'fixtures', 'freetrade-example.csv')
    await fileInput.setInputFiles(filePath)

    // Wait for import to complete
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 10000 })
  })

  test('should show Incomplete badge for FOOD disposal in transaction list', async ({ page }) => {
    // The FOOD SELL transaction (2025-01-20) has no matching acquisitions
    // Select tax year 2024/25 first to ensure FOOD is visible
    const taxYearSelect = page.locator('select').first()
    await taxYearSelect.selectOption('2024/25')
    await page.waitForTimeout(500)

    // Look for the transaction row containing FOOD
    const foodRow = page.locator('tbody tr').filter({ hasText: 'FOOD' }).filter({ hasText: '2025-01-20' })
    await expect(foodRow).toBeVisible()

    // Check for the red Incomplete badge
    const incompleteBadge = foodRow.locator('span.bg-red-100.text-red-800').filter({ hasText: 'Incomplete' })
    await expect(incompleteBadge).toBeVisible()
  })

  test('should show Incomplete badge for GlobalBank disposal in transaction list', async ({ page }) => {
    // GlobalBank SELL transaction (2025-07-15) has no matching acquisitions
    const gbnkRow = page.locator('tr').filter({ hasText: 'GBNK' }).filter({ hasText: '2025-07-15' })
    await expect(gbnkRow).toBeVisible()

    // Check for the red Incomplete badge
    const incompleteBadge = gbnkRow.locator('.bg-red-100.text-red-800').filter({ hasText: 'Incomplete' })
    await expect(incompleteBadge).toBeVisible()
  })

  test('should show Incomplete badge for TravelGroup disposal in transaction list', async ({ page }) => {
    // TravelGroup SELL transaction (2025-04-18) has no matching acquisitions
    const trvlRow = page.locator('tr').filter({ hasText: 'TRVL' }).filter({ hasText: '2025-04-18' })
    await expect(trvlRow).toBeVisible()

    // Check for the red Incomplete badge
    const incompleteBadge = trvlRow.locator('.bg-red-100.text-red-800').filter({ hasText: 'Incomplete' })
    await expect(incompleteBadge).toBeVisible()
  })

  test('should NOT show Section 104 badge for fully unmatched disposals', async ({ page }) => {
    // FOOD is fully unmatched - should NOT show Section 104 badge
    const foodRow = page.locator('tr').filter({ hasText: 'FOOD' }).filter({ hasText: '2025-01-20' })
    await expect(foodRow).toBeVisible()

    // Should have Incomplete badge
    await expect(foodRow.locator('.bg-red-100.text-red-800').filter({ hasText: 'Incomplete' })).toBeVisible()

    // Should NOT have Section 104 badge
    await expect(foodRow.locator('.bg-green-100.text-green-800').filter({ hasText: 'Section 104' })).not.toBeVisible()
  })

  test('should report incomplete disposals per tax year in the Issues panel', async ({ page }) => {
    const issue = await incompleteDisposalsIssue(page)
    await expect(issue).toBeVisible()

    // 2024/25 has the FOOD disposal
    await expect(issue).toContainText('2024/25: 1')

    // The note about gains/losses only including matched portions
    await expect(issue).toContainText('Gains/losses are only calculated for matched portions')

    // Next to the figures, a one-line pointer counts the selected year's
    await page.locator('select').filter({ hasText: /2024\/25/ }).first().selectOption('2024/25')
    await expect(page.getByTestId('incomplete-disposals-pointer')).toContainText('1 disposal this tax year could')
  })

  test('should show correct disposal counts in tax year summary', async ({ page }) => {
    // Select tax year 2024/25
    const taxYearSelect = page.locator('select').first()
    await taxYearSelect.selectOption('2024/25')

    await page.waitForTimeout(500)

    // Find the "DISPOSALS" section - use more specific selector
    const disposalsCard = page.locator('div.bg-white').filter({ hasText: 'DISPOSALS' }).first()
    await expect(disposalsCard).toBeVisible()

    // Should show 1 disposal (FOOD)
    await expect(disposalsCard).toContainText('1')
  })

  test('should show £0 proceeds and £0 gains for fully unmatched disposal', async ({ page }) => {
    // Select tax year 2024/25
    const taxYearSelect = page.locator('select').first()
    await taxYearSelect.selectOption('2024/25')

    await page.waitForTimeout(500)

    // Total proceeds should be £0 (no matched shares) - use more specific selector
    const proceedsCard = page.locator('div.bg-white').filter({ hasText: 'TOTAL PROCEEDS' }).first()
    await expect(proceedsCard).toContainText('£0')

    // Total gains should be £0 - use more specific selector
    const gainsCard = page.locator('div.bg-green-50').filter({ hasText: 'Gains' }).first()
    await expect(gainsCard).toContainText('£0')
  })

  test('should show multiple incomplete disposals for tax year 2025/26', async ({ page }) => {
    // Select tax year 2025/26 which has GlobalBank and TravelGroup unmatched disposals
    const taxYearSelect = page.locator('select').filter({ hasText: /2025\/26/ }).first()
    await taxYearSelect.selectOption('2025/26')

    await page.waitForTimeout(500)

    // The Issues panel counts 2 for 2025/26 (GlobalBank and TravelGroup)
    const issue = await incompleteDisposalsIssue(page)
    await expect(issue).toContainText('2025/26: 2')
    await expect(page.getByTestId('incomplete-disposals-pointer')).toContainText('2 disposals this tax year could')
  })

  test('should persist incomplete disposal state after page reload', async ({ page }) => {
    // Select tax year 2024/25
    const taxYearSelect = page.locator('select').filter({ hasText: /2024\/25/ }).first()
    await taxYearSelect.selectOption('2024/25')
    await page.waitForTimeout(500)

    // Verify incomplete badge is visible
    const foodRow = page.locator('tr').filter({ hasText: 'FOOD' }).filter({ hasText: '2025-01-20' })
    await expect(foodRow.locator('.bg-red-100.text-red-800').filter({ hasText: 'Incomplete' })).toBeVisible()

    // Reload the page
    await page.reload()
    await page.waitForTimeout(1000)

    // Handle session resume dialog if it appears
    const continueButton = page.getByRole('button', { name: /Continue Session/i })
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click()
      await page.waitForTimeout(500)
    }

    // Select tax year again
    const taxYearSelectAfterReload = page.locator('select').filter({ hasText: /2024\/25/ }).first()
    await taxYearSelectAfterReload.selectOption('2024/25')
    await page.waitForTimeout(500)

    // Incomplete badge should still be visible after reload
    const foodRowAfterReload = page.locator('tr').filter({ hasText: 'FOOD' }).filter({ hasText: '2025-01-20' })
    await expect(foodRowAfterReload.locator('.bg-red-100.text-red-800').filter({ hasText: 'Incomplete' })).toBeVisible()

    // The Issues panel should still report it
    const issue = await incompleteDisposalsIssue(page)
    await expect(issue).toContainText('2024/25: 1')
  })
})
