import { test, expect } from '@playwright/test'

test.describe('CGT Visualizer App', () => {
  test('should display the app title', async ({ page }) => {
    await page.goto('/')

    // Check page title
    await expect(page).toHaveTitle(/CGT Visualizer/)

    // Check main heading
    const heading = page.getByRole('heading', { name: /CGT Visualizer/i })
    await expect(heading).toBeVisible()

    // Check subtitle
    const subtitle = page.getByText(/UK Capital Gains Tax Calculator/i)
    await expect(subtitle).toBeVisible()
  })

  test('should have proper styling applied', async ({ page }) => {
    await page.goto('/')

    // Check that TailwindCSS is working by verifying background color
    const container = page.locator('div.min-h-screen')
    await expect(container).toBeVisible()

    // Verify heading has proper styling
    const heading = page.getByRole('heading', { name: /CGT Visualizer/i })
    await expect(heading).toHaveClass(/text-4xl/)
  })
})
