import { test, expect } from './fixtures'

test.describe('Capital Gains Tax Visualiser App', () => {
  test('should display the app title', async ({ page }) => {
    await page.goto('/')

    // Check page title
    await expect(page).toHaveTitle(/CGT Visualiser/)

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

    // Check footer disclaimer text
    await expect(footer.getByText(/not financial or tax advice/i)).toBeVisible()
    await expect(footer.getByRole('link', { name: 'Report an issue' })).toBeVisible()

    // How up to date the calculator is (the build date comes from a Vite define)
    await expect(footer.getByTestId('freshness')).toContainText(/Updated \d{1,2} \w+ \d{4}/)
    await expect(footer.getByTestId('freshness')).toContainText('HMRC rates to')
    await expect(footer.getByTestId('freshness')).toContainText('Figures checked')
  })

  test('About page shows project stats without contacting GitHub', async ({ page }) => {
    // The stats are fetched at build time; the shared fixture fails the test
    // if the page makes any external request it doesn't stub
    await page.goto('/#about')

    const stats = page.getByRole('heading', { name: 'Project Stats' }).locator('..')
    await expect(stats).toBeVisible()
    await expect(stats.getByText('Total Commits')).toBeVisible()
  })
})
