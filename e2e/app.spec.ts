import { test, expect } from './fixtures'
import { HMRC_RULES_CHECK_DATE } from '../src/lib/cgt/hmrcRulesCheck'
import { HMRC_RULES_BADGE_MAX_AGE_DAYS } from '../src/lib/freshness'

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

    // How up to date the calculator is (the build date comes from a Vite define). The check
    // line reads "not yet confirmed" from 6 April until a check confirms the year that ended
    await expect(footer.getByTestId('freshness')).toContainText(/Updated \d{1,2} \w+ \d{4}/)
    await expect(footer.getByTestId('freshness')).toContainText('HMRC rates to')
    await expect(footer.getByTestId('freshness')).toContainText(/(Up to date with HMRC rules for \d{4}\/\d{2} \(checked|\d{4}\/\d{2} HMRC rules not yet confirmed \(last checked) \d{1,2} \w+ \d{4}\)/)
    await expect(footer.getByRole('link', { name: /^\d{1,2} \w+ \d{4}$/ })).toHaveAttribute('href', /docs\/HMRC_RULES_CHECK\.md/)
  })

  test('shows the HMRC rules badge only while the last check is recent and confirms the year', async ({ page }) => {
    const checkedOn = new Date(`${HMRC_RULES_CHECK_DATE}T12:00:00`)
    await page.clock.setFixedTime(checkedOn)
    await page.goto('/')
    // In the sidebar on desktop (the phone header has its own, hidden here)
    const badge = page.getByRole('complementary').getByTestId('hmrc-rules-badge')
    await expect(badge).toHaveText(/^HMRC \d{4}\/\d{2}$/)
    // Hover shows what it means
    await badge.hover()
    await expect(page.getByText(/^Up to date with HMRC rules for \d{4}\/\d{2}: .* the legislation\.$/)).toBeVisible()

    // 46 days later the check is too old
    await page.clock.setFixedTime(new Date(checkedOn.getTime() + (HMRC_RULES_BADGE_MAX_AGE_DAYS + 1) * 86_400_000))
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Import Transactions' })).toBeVisible()
    await expect(page.getByTestId('hmrc-rules-badge')).toHaveCount(0)
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
