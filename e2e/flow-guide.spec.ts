import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test.describe('How it works line', () => {
  test('tracks progress and jumps to each section once it exists', async ({ page }) => {
    await page.goto('/')
    const flow = page.getByTestId('flow-guide')

    // Before any import only the first two stops are links
    await expect(flow.getByRole('link')).toHaveCount(2)
    await expect(flow.getByRole('link', { name: /Import/ })).toHaveAttribute('href', '#import')

    await page.getByTestId('load-sample').click()
    await expect(page.getByTestId('tax-status')).toBeVisible({ timeout: 20000 })

    // After an import every stop is a link and the first two are ticked off
    await expect(flow.getByRole('link')).toHaveCount(5)
    const done = flow.getByRole('link', { name: /\(done\)/ })
    await expect(done).toHaveCount(2)
    await expect(flow.getByRole('link', { name: /^Check.*\(done\)/ })).toHaveCount(0)

    // Visiting a section ticks it off: Check jumps to the table, passing the summary
    await flow.getByRole('link', { name: /Check/ }).click()
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeInViewport()
    await expect(flow.getByRole('link', { name: /^Check.*\(done\)/ })).toHaveCount(1)
    await expect(flow.getByRole('link', { name: /^Tax year.*\(done\)/ })).toHaveCount(1)

    // PDF jumps to the button, and ticks off once the report is exported
    await page.evaluate(() => window.scrollTo(0, 0))
    await flow.getByRole('link', { name: /PDF/ }).click()
    await expect(page.locator('#export-pdf')).toBeInViewport()
    const download = page.waitForEvent('download', { timeout: 30000 })
    await page.locator('#export-pdf').getByRole('button', { name: /^Export PDF/ }).first().click()
    await download
    await expect(done).toHaveCount(5)
  })

  test('still ticks sections off after the results recalculate', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('load-sample').click()
    await expect(page.getByText(/Loaded a sample Charles Schwab portfolio/)).toBeVisible({ timeout: 20000 })

    // A second import recalculates, replacing the sections the line watches
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'fixtures', 'generic-sample.csv'))
    await expect(page.getByText(/file\(s\) imported successfully/)).toBeVisible({ timeout: 20000 })

    const flow = page.getByTestId('flow-guide')
    await expect(flow.getByRole('link', { name: /^Check.*\(done\)/ })).toHaveCount(0)

    // Scrolling (not clicking the line) still ticks Check off
    await page.evaluate(() => document.getElementById('transactions')!.scrollIntoView({ block: 'start' }))
    await expect(flow.getByRole('link', { name: /^Check.*\(done\)/ })).toHaveCount(1)
  })

  test('only links to sections that exist: no PDF stop without disposals', async ({ page }) => {
    await page.goto('/')
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'fixtures', 'generic-dividends-only.csv'))
    const flow = page.getByTestId('flow-guide')
    await expect(flow.getByRole('link', { name: /\(done\)/ })).toHaveCount(2, { timeout: 20000 })

    // Dividends alone still give a tax year summary (the income), but no PDF button
    await expect(flow.getByRole('link', { name: /PDF/ })).toHaveCount(0)

    // Every stop that is a link points at something on the page
    for (const href of await flow.getByRole('link').evaluateAll(links => links.map(a => a.getAttribute('href')))) {
      await expect(page.locator(href!)).toHaveCount(1)
    }
  })
})
