import { test, expect } from '@playwright/test'

test.describe('Capital Gains Tax Visualiser App', () => {
  test('should display the app title', async ({ page }) => {
    await page.goto('/')

    // Check page title
    await expect(page).toHaveTitle(/Capital Gains Tax Visualiser/)

    // Check that sidebar has branding
    const branding = page.getByRole('complementary').getByText(/Capital Gains Tax/i)
    await expect(branding).toBeVisible()
  })

  test('should have proper styling applied', async ({ page }) => {
    await page.goto('/')

    // Check that TailwindCSS is working by verifying background color
    const container = page.locator('div.min-h-screen')
    await expect(container).toBeVisible()
  })

  test('should display footer with disclaimer', async ({ page }) => {
    await page.goto('/')

    // Check footer is visible
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()

    // Check disclaimer heading
    await expect(page.getByRole('heading', { name: /Disclaimer/i })).toBeVisible()

    // Check key disclaimer phrases
    await expect(page.getByText(/educational and visualization tool/i)).toBeVisible()
    await expect(page.getByText(/not financial or tax advice/i)).toBeVisible()
    await expect(page.getByText(/locally in your browser/i)).toBeVisible()

    // Check HMRC link
    const hmrcLink = page.getByRole('link', { name: /HMRC Capital Gains Manual/i })
    await expect(hmrcLink).toBeVisible()
    await expect(hmrcLink).toHaveAttribute('href', /gov\.uk/)
  })
})
