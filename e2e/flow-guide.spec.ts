import { test, expect } from '@playwright/test'

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
    await expect(flow.getByRole('link', { name: /\(done\)/ })).toHaveCount(2)

    await flow.getByRole('link', { name: /Check/ }).click()
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeInViewport()

    await page.evaluate(() => window.scrollTo(0, 0))
    await flow.getByRole('link', { name: /PDF/ }).click()
    await expect(page.locator('#export-pdf')).toBeInViewport()
  })
})
