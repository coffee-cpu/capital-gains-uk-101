import { test, expect } from '@playwright/test'

/**
 * Database version 5 converts Interactive Brokers debit (margin) interest that
 * was imported as INTEREST into FEE. Seed a version 4 database on the app's
 * origin, load the app so Dexie runs the upgrade, then read the rows back.
 */
test('upgrades stored IB debit interest from INTEREST to FEE', async ({ page }) => {
  // Same origin as the app, but a static file, so the app doesn't open the database first
  await page.goto('/llms.txt')

  await page.evaluate(async () => {
    const base = {
      source: 'Interactive Brokers',
      symbol: 'CASH',
      currency: 'USD',
      quantity: null,
      price: null,
      fee: null,
      ratio: null,
      incomplete: false,
      ignored: false,
    }
    const rows = [
      { ...base, id: 'f-1', date: '2022-02-03', type: 'INTEREST', total: -14.63, notes: 'Debit Interest', name: 'USD Debit Interest for Jan-2022' },
      // Bond accrued interest paid was also noted "Debit Interest" and must stay INTEREST
      { ...base, id: 'f-2', date: '2025-03-25', type: 'INTEREST', total: -1.87, notes: 'Debit Interest', name: 'Purchase Accrued Interest UKT 0 5/8 06/07/25' },
      { ...base, id: 'f-3', date: '2024-10-03', type: 'INTEREST', total: 0.91, notes: 'Credit Interest', name: 'USD Credit Interest for Sep-2024' },
    ]

    await new Promise<void>((resolve, reject) => {
      // Dexie stores version(4) as IndexedDB version 40
      const request = indexedDB.open('cgt-visualizer', 40)
      request.onupgradeneeded = () => {
        const db = request.result
        const transactions = db.createObjectStore('transactions', { keyPath: 'id' })
        for (const index of ['source', 'symbol', 'date', 'type']) transactions.createIndex(index, index)
        const fxRates = db.createObjectStore('fx_rates', { keyPath: 'id' })
        for (const index of ['date', 'currency', 'fxSource']) fxRates.createIndex(index, index)
        const files = db.createObjectStore('imported_files', { keyPath: 'fileId' })
        for (const index of ['filename', 'importedAt']) files.createIndex(index, index)
        db.createObjectStore('settings', { keyPath: 'key' })
        db.createObjectStore('split_data_cache', { keyPath: 'year' })
      }
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('transactions', 'readwrite')
        for (const row of rows) tx.objectStore('transactions').put(row)
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
      request.onerror = () => reject(request.error)
    })
  })

  await page.goto('/')
  // The app has opened (and so upgraded) the database once it offers to restore the session
  await expect(page.getByText('Previous Session Found')).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Continue Session' }).click()

  const types = await page.evaluate(async () => {
    return new Promise<Record<string, string>>((resolve, reject) => {
      const request = indexedDB.open('cgt-visualizer')
      request.onsuccess = () => {
        const db = request.result
        const getAll = db.transaction('transactions').objectStore('transactions').getAll()
        getAll.onsuccess = () => {
          const result = Object.fromEntries(
            (getAll.result as Array<{ id: string; type: string }>).map(row => [row.id, row.type])
          )
          db.close()
          resolve(result)
        }
        getAll.onerror = () => reject(getAll.error)
      }
      request.onerror = () => reject(request.error)
    })
  })

  expect(types).toEqual({ 'f-1': 'FEE', 'f-2': 'INTEREST', 'f-3': 'INTEREST' })
})
