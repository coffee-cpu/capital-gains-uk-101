import { test, expect } from '@playwright/test'

test.describe('First run', () => {
  test('a sample portfolio can be loaded in one click', async ({ page }) => {
    await page.goto('/')

    // The empty app offers the sample instead of an empty transactions box
    const loadSample = page.getByTestId('load-sample')
    await expect(loadSample).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toHaveCount(0)

    await loadSample.click()

    // The sample is imported and flagged as something to clear before real files
    await expect(page.getByText(/Loaded a sample Charles Schwab portfolio/)).toBeVisible({ timeout: 20000 })
    await expect(loadSample).toHaveCount(0)

    // The tax year summary leads with the answer
    const answer = page.getByTestId('tax-year-answer')
    await expect(answer).toContainText(/net (gain|loss)/)
    await expect(answer).toContainText(/No CGT to pay|CGT to pay/)

    // The link to the per-transaction detail lands on the table
    await page.getByRole('link', { name: 'See every transaction' }).click()
    await expect(page).toHaveURL(/#transactions$/)
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeInViewport()
  })

  test('the sample is not merged into transactions from a previous session', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('load-sample').click()
    await expect(page.getByTestId('tax-year-answer')).toBeVisible({ timeout: 20000 })

    // A returning visit: stored transactions, nothing loaded yet. Click the
    // sample button directly, as if before the resume-session dialog opened
    await page.reload()
    await page.getByTestId('load-sample').evaluate((button: HTMLElement) => button.click())

    await expect(page.getByText(/You already have imported transactions/)).toBeVisible()
    await expect(page.getByText(/Loaded a sample Charles Schwab portfolio/)).toHaveCount(0)
  })
})
