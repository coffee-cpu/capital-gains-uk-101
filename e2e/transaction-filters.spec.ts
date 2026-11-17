import { test, expect, type Page } from '@playwright/test'

async function loadSample(page: Page) {
  await page.goto('/')
  await page.getByTestId('load-sample').click()
  await expect(page.getByTestId('tax-status')).toBeVisible({ timeout: 20000 })
}

test.describe('Transactions table', () => {
  test('filters by symbol, type and tax year, together', async ({ page }) => {
    await loadSample(page)
    const rows = page.locator('#transactions tbody tr')
    const count = page.getByTestId('filter-count')
    await expect(rows).toHaveCount(27)
    await expect(count).toHaveCount(0)

    // Symbol search is case-insensitive and matches option names too
    await page.getByLabel('Search by symbol').fill('smci')
    await expect(count).toContainText('Showing 4 of 27')
    for (const row of await rows.all()) await expect(row).toContainText('SMCI')

    // Income covers dividends, interest and the tax withheld on them
    await page.getByLabel('Search by symbol').fill('')
    await page.getByLabel('Filter by type').selectOption('income')
    await expect(count).toContainText('Showing 6 of 27')
    for (const row of await rows.all()) await expect(row).toContainText(/DIVIDEND|INTEREST/)

    // Filters combine: income in 2023/24 is the one AAPL dividend (paid 5 April 2024)
    await page.getByLabel('Filter by tax year').selectOption('2023/24')
    await expect(count).toContainText('Showing 1 of 27')
    await expect(rows.first()).toContainText('AAPL')

    // Nothing matches: say so rather than show an empty table
    await page.getByLabel('Search by symbol').fill('zzzz')
    await expect(page.getByText('No transactions match these filters.')).toBeVisible()

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(rows).toHaveCount(27)
    await expect(count).toHaveCount(0)
    await expect(page.getByLabel('Filter by type')).toHaveValue('all')
  })

  test('shows each amount in GBP with the broker amount underneath', async ({ page }) => {
    await loadSample(page)
    const buy = page.locator('#transactions tbody tr').filter({ hasText: '2024-01-15' })
    // One column each for price, total and fee (no separate "(GBP)" columns)
    await expect(page.locator('#transactions thead th')).toHaveText([
      /CGT Rule/i, /Date/i, /Symbol/i, /Type/i, /Quantity/i, /Price/i, /Total/i, /Fee/i, /Source/i,
    ])
    await expect(buy).toContainText('$150.00')
    await expect(buy).toContainText('$1,500.00')
    await expect(buy).toContainText(/£[\d,]+\.\d\d/)
  })

  test('fits without scrolling sideways on a 1280px screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await loadSample(page)
    const sizes = await page.locator('#transactions table').evaluate(table => {
      const scroller = table.parentElement!
      return { scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth }
    })
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth)
  })
})
