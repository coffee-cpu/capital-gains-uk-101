import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** A setting as stored in the app's IndexedDB `settings` table, or null */
function storedSetting(page: Page, key: string): Promise<string | null> {
  return page.evaluate(key => new Promise<string | null>(resolve => {
    const open = indexedDB.open('cgt-visualizer')
    open.onerror = () => resolve(null)
    open.onsuccess = () => {
      const db = open.result
      try {
        const get = db.transaction('settings', 'readonly').objectStore('settings').get(key)
        get.onsuccess = () => { resolve(get.result?.value ?? null); db.close() }
        get.onerror = () => { resolve(null); db.close() }
      } catch {
        // No settings table (e.g. a schema change): read as unset rather than hang
        resolve(null)
        db.close()
      }
    }
  }), key)
}

test.describe('PDF export options', () => {
  test('chooses, remembers and exports the transaction history appendix', async ({ page }) => {
    await page.goto('/')
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'fixtures', 'generic-multi-company.csv'))
    await expect(page.getByText(/file\(s\) imported successfully/i)).toBeVisible({ timeout: 15000 })

    const exportButton = page.getByRole('button', { name: /^Export PDF/ }).first()
    await expect(exportButton).toHaveText('Export PDF')

    const toggle = page.getByRole('button', { name: 'PDF export options' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    const options = page.getByRole('dialog', { name: 'PDF export options' })
    await expect(options.getByRole('radio', { name: /^None/ })).toBeChecked()
    await expect(options.getByText(/^\d[\d,]* transactions?, \d{2}\/\d{2}\/\d{4} to 05\/04\/\d{4}$/)).toBeVisible()
    await expect(options.getByText(/including earlier years/)).toBeVisible()

    await options.getByRole('radio', { name: /^Tax year/ }).check()
    await expect(exportButton).toHaveText('Export PDF + history')

    // Escape closes the panel and returns focus to its toggle
    await page.keyboard.press('Escape')
    await expect(options).toBeHidden()
    await expect(toggle).toBeFocused()

    // The choice survives a reload. It's written to IndexedDB asynchronously,
    // so wait for the write first: reloading straight away can beat it
    await expect.poll(() => storedSetting(page, 'pdfTransactionHistory')).toBe('tax-year')
    await page.reload()
    await page.getByRole('button', { name: 'Continue Session' }).click()
    await expect(page.getByRole('heading', { name: 'Tax Year Summary' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /^Export PDF/ }).first()).toHaveText('Export PDF + history')
    await page.getByRole('button', { name: 'PDF export options' }).click()
    await expect(page.getByRole('radio', { name: /^Tax year/ })).toBeChecked()

    // Exporting from the panel downloads the report and closes the panel
    const download = page.waitForEvent('download', { timeout: 30000 })
    await page.getByRole('dialog', { name: 'PDF export options' }).getByRole('button', { name: 'Export PDF' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/\.pdf$/)
    await expect(page.getByRole('dialog', { name: 'PDF export options' })).toBeHidden()

    // The report's monospace font is loaded from this site and embedded
    const pdf = readFileSync((await file.path())!).toString('latin1')
    expect(pdf).toContain('+IBMPlexMono-Regular')
  })
})
