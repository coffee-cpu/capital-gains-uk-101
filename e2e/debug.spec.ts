import { test, expect } from '@playwright/test'

/**
 * Debug test for capturing browser console logs and errors
 * Run this test when investigating frontend issues like blank screens or runtime errors
 *
 * Usage: npx playwright test e2e/debug.spec.ts --headed
 */
test.describe('Debug - Console Logs', () => {
  test('should load page and capture all console logs', async ({ page }) => {
    const consoleLogs: string[] = []
    const consoleErrors: string[] = []
    const pageErrors: string[] = []

    // Capture all console messages
    page.on('console', (msg) => {
      const type = msg.type()
      const text = msg.text()
      const location = msg.location()
      const logEntry = `[${type.toUpperCase()}] ${text}${location.url ? ` at ${location.url}:${location.lineNumber}` : ''}`

      if (type === 'error') {
        consoleErrors.push(logEntry)
      } else {
        consoleLogs.push(logEntry)
      }

      console.log(logEntry)
    })

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      const errorMsg = `[PAGE ERROR] ${error.message}\nStack: ${error.stack}`
      pageErrors.push(errorMsg)
      console.error(errorMsg)
    })

    // Capture failed requests
    page.on('requestfailed', (request) => {
      const failureMsg = `[REQUEST FAILED] ${request.url()}: ${request.failure()?.errorText}`
      console.error(failureMsg)
    })

    // Navigate to the page
    await page.goto('/')

    // Wait a bit for any async errors to surface
    await page.waitForTimeout(2000)

    // Take a screenshot for visual inspection
    await page.screenshot({ path: 'playwright-debug-screenshot.png', fullPage: true })
    console.log('\nScreenshot saved to: playwright-debug-screenshot.png')

    // Log summary
    console.log('\n=== SUMMARY ===')
    console.log(`Console logs: ${consoleLogs.length}`)
    console.log(`Console errors: ${consoleErrors.length}`)
    console.log(`Page errors: ${pageErrors.length}`)

    if (consoleErrors.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===')
      consoleErrors.forEach(err => console.log(err))
    }

    if (pageErrors.length > 0) {
      console.log('\n=== PAGE ERRORS ===')
      pageErrors.forEach(err => console.log(err))
    }

    // Assert page loaded successfully (basic checks)
    await expect(page).toHaveTitle(/Capital Gains Tax Visualiser/)

    // Assert no critical errors occurred
    expect(pageErrors, 'Page should not have uncaught errors').toHaveLength(0)

    // Note: Console errors might include non-critical warnings, so we don't fail on those
  })

  test('should verify all main components are visible', async ({ page }) => {
    const consoleLogs: string[] = []

    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
    })

    page.on('pageerror', (error) => {
      console.error(`[PAGE ERROR] ${error.message}`)
    })

    await page.goto('/')

    // Check page title and main components render
    await expect(page).toHaveTitle(/Capital Gains Tax Visualiser/)
    await expect(page.getByText(/Import Transactions/i)).toBeVisible()

    console.log(`\nCaptured ${consoleLogs.length} console messages`)
  })
})
