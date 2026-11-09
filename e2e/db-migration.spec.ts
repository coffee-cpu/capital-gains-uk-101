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

/**
 * A stored schema Dexie can't upgrade (here fx_rates keyed on [date+currency],
 * from before version 3) makes ensureDatabaseCompatible delete and recreate
 * the database. Transactions and settings must survive the reset: losing the
 * FX source would silently switch the figures to the default rates.
 */
test('keeps transactions and settings through a database reset', async ({ page }) => {
  // Same origin as the app, but a static file, so the app doesn't open the database first
  await page.goto('/llms.txt')

  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      // Dexie stores version(4) as IndexedDB version 40
      const request = indexedDB.open('cgt-visualizer', 40)
      request.onupgradeneeded = () => {
        const db = request.result
        const transactions = db.createObjectStore('transactions', { keyPath: 'id' })
        for (const index of ['source', 'symbol', 'date', 'type']) transactions.createIndex(index, index)
        // The pre-version-3 primary key: Dexie can't change it in an upgrade
        const fxRates = db.createObjectStore('fx_rates', { keyPath: ['date', 'currency'] })
        for (const index of ['date', 'currency']) fxRates.createIndex(index, index)
        const files = db.createObjectStore('imported_files', { keyPath: 'fileId' })
        for (const index of ['filename', 'importedAt']) files.createIndex(index, index)
        db.createObjectStore('settings', { keyPath: 'key' })
        db.createObjectStore('split_data_cache', { keyPath: 'year' })
      }
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction(['transactions', 'settings'], 'readwrite')
        tx.objectStore('transactions').put({
          // In USD, so the FX source selector is shown; 2023 rates are bundled (no network)
          id: 'f-1', source: 'Generic CSV', symbol: 'ACME', name: null, date: '2023-05-01',
          type: 'BUY', quantity: 10, price: 5, currency: 'USD', total: 50, fee: null, notes: null,
        })
        tx.objectStore('settings').put({ key: 'fxSource', value: 'HMRC_YEARLY_AVG', updatedAt: '2024-05-01T00:00:00.000Z' })
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
      request.onerror = () => reject(request.error)
    })
  })

  await page.goto('/')
  // The salvaged transaction is offered as a previous session
  await expect(page.getByText('Previous Session Found')).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Continue Session' }).click()

  // The restored setting is in use
  await expect(page.getByRole('button', { name: 'HMRC Yearly Average' })).toBeVisible()

  const stored = await page.evaluate(async () => {
    return new Promise<{ fxRatesKey: unknown; transactionIds: string[]; fxSource: unknown }>((resolve, reject) => {
      const request = indexedDB.open('cgt-visualizer')
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction(['fx_rates', 'transactions', 'settings'])
        const fxRatesKey = tx.objectStore('fx_rates').keyPath
        const ids = tx.objectStore('transactions').getAllKeys()
        const setting = tx.objectStore('settings').get('fxSource')
        tx.oncomplete = () => {
          db.close()
          resolve({
            fxRatesKey,
            transactionIds: ids.result as string[],
            fxSource: (setting.result as { value?: unknown } | undefined)?.value,
          })
        }
        tx.onerror = () => reject(tx.error)
      }
      request.onerror = () => reject(request.error)
    })
  })

  // The database was recreated with the current schema...
  expect(stored.fxRatesKey).toBe('id')
  // ...and kept the user's data
  expect(stored.transactionIds).toEqual(['f-1'])
  expect(stored.fxSource).toBe('HMRC_YEARLY_AVG')
})
