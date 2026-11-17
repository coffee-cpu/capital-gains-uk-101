import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ownFile = path.join(__dirname, 'fixtures', 'generic-sample.csv')

test.describe('First run', () => {
  test('a sample portfolio can be loaded in one click', async ({ page }) => {
    await page.goto('/')

    // The empty app offers the sample instead of an empty transactions box
    const loadSample = page.getByTestId('load-sample')
    await expect(loadSample).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toHaveCount(0)

    await loadSample.click()

    // The sample is imported, and the user is told their files will replace it
    await expect(page.getByText(/Loaded a sample Charles Schwab portfolio/)).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(/Your own files will replace it automatically/)).toBeVisible()
    await expect(loadSample).toHaveCount(0)

    // The tax year summary says whether CGT is due, and whether to report
    const status = page.getByTestId('tax-status')
    await expect(status).toBeVisible()
    await expect(status).toContainText(/SA108/)

    // The link to the per-transaction detail lands on the table
    await page.getByRole('link', { name: 'See every transaction' }).click()
    await expect(page).toHaveURL(/#transactions$/)
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeInViewport()
  })

  test('the sample is not merged into transactions from a previous session', async ({ page }) => {
    await page.goto('/')
    await page.locator('input[type="file"]').setInputFiles(ownFile)
    await expect(page.getByTestId('imported-files-summary')).toBeVisible({ timeout: 20000 })

    // A returning visit: stored transactions, nothing loaded yet. Click the
    // sample button directly, as if before the resume-session dialog opened
    await page.reload()
    await page.getByTestId('load-sample').evaluate((button: HTMLElement) => button.click())

    await expect(page.getByText(/You already have imported transactions/)).toBeVisible()
    await expect(page.getByText(/Loaded a sample Charles Schwab portfolio/)).toHaveCount(0)
  })

  test('importing your own files replaces the sample', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('load-sample').click()
    const summary = page.getByTestId('imported-files-summary')
    // Wait until the sample has finished loading (the file input is disabled until then)
    await expect(page.getByText(/Loaded a sample Charles Schwab portfolio/)).toBeVisible({ timeout: 20000 })
    await expect(summary).toContainText('sample-portfolio.csv')

    await page.locator('input[type="file"]').setInputFiles(ownFile)

    await expect(page.getByText(/Removed the sample portfolio/)).toBeVisible({ timeout: 20000 })
    await expect(summary).toContainText('generic-sample.csv')
    await expect(summary).not.toContainText('sample-portfolio.csv')
    await expect(summary).toContainText(/^1 file/)
  })

  test('the sample is not kept for the next visit', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('load-sample').click()
    await expect(page.getByTestId('tax-status')).toBeVisible({ timeout: 20000 })

    await page.reload()

    // No "continue previous session?" prompt: the app starts empty
    await expect(page.getByTestId('load-sample')).toBeVisible()
    await expect(page.getByText(/previous session/i)).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => new Promise<number>((resolve) => {
      const req = indexedDB.open('cgt-visualizer')
      req.onsuccess = () => {
        const tx = req.result.transaction('transactions', 'readonly')
        const countReq = tx.objectStore('transactions').count()
        countReq.onsuccess = () => { req.result.close(); resolve(countReq.result) }
      }
    }))).toBe(0)
    await expect(page.getByRole('button', { name: 'Continue Session' })).toHaveCount(0)
  })

  test('the import panel lists the files and is the one place to clear them', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('load-sample').click()
    await expect(page.getByTestId('tax-status')).toBeVisible({ timeout: 20000 })

    const summary = page.getByTestId('imported-files-summary')
    await expect(summary).toContainText('1 file · 27 transactions')
    await expect(summary).toContainText('sample-portfolio.csv')
    // The drop zone shrinks to one line once there's data
    await expect(page.getByText('Add more CSV files')).toBeVisible()

    // One Clear all data button, in the import panel. It opens a dialog that
    // says what goes and starts on Cancel; Escape closes it
    await expect(page.getByRole('button', { name: 'Clear all data' })).toHaveCount(1)
    await summary.getByRole('button', { name: 'Clear all data' }).click()
    const dialog = page.getByRole('dialog', { name: 'Clear all data?' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('1 file and 27 transactions')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await summary.getByRole('button', { name: 'Clear all data' }).click()
    await dialog.getByRole('button', { name: 'Delete everything' }).click()

    // The page reloads empty, offering the sample again
    await expect(page.getByTestId('load-sample')).toBeVisible({ timeout: 10000 })
    await expect(summary).toHaveCount(0)
    await expect(page.getByText('Drop your CSV files here')).toBeVisible()
  })
})
