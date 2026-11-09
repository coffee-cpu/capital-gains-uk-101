// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CGTCalculationResult } from '../../types/cgt'

const settingsTable = new Map<string, { key: string; value: string }>()
vi.mock('../../lib/db', () => ({
  db: {
    settings: {
      get: async (key: string) => settingsTable.get(key),
      put: async (row: { key: string; value: string }) => { settingsTable.set(row.key, row) },
    },
  },
}))

const processTransactionsFromDB = vi.fn()
vi.mock('../../lib/transactionProcessor', () => ({
  processTransactionsFromDB: (...args: unknown[]) => processTransactionsFromDB(...args),
}))

function results(...taxYears: string[]): CGTCalculationResult {
  return {
    transactions: [],
    disposals: [],
    section104Pools: new Map(),
    taxYearSummaries: taxYears.map(taxYear => ({ taxYear }) as CGTCalculationResult['taxYearSummaries'][number]),
    metadata: { calculatedAt: '', totalTransactions: 0, totalBuys: 0, totalSells: 0 },
  }
}

async function loadStores() {
  vi.resetModules()
  const { useTransactionStore } = await import('../transactionStore')
  const { useSettingsStore, LEGACY_SETTINGS_KEY } = await import('../settingsStore')
  return { useTransactionStore, useSettingsStore, LEGACY_SETTINGS_KEY }
}

beforeEach(() => {
  settingsTable.clear()
  localStorage.clear()
  processTransactionsFromDB.mockReset()
})

describe('transactionStore.setCGTResults', () => {
  it('keeps the selected tax year when the new results still have it', async () => {
    const { useTransactionStore } = await loadStores()
    useTransactionStore.getState().setCGTResults(results('2024/25', '2023/24'))
    useTransactionStore.getState().setSelectedTaxYear('2023/24')

    useTransactionStore.getState().setCGTResults(results('2024/25', '2023/24'))

    expect(useTransactionStore.getState().selectedTaxYear).toBe('2023/24')
  })

  it('falls back to the most recent year when the selected one is gone', async () => {
    const { useTransactionStore } = await loadStores()
    useTransactionStore.getState().setSelectedTaxYear('2019/20')

    useTransactionStore.getState().setCGTResults(results('2024/25', '2023/24'))

    expect(useTransactionStore.getState().selectedTaxYear).toBe('2024/25')
  })
})

describe('transactionStore.recalculate', () => {
  it('applies only the latest of overlapping runs', async () => {
    const { useTransactionStore } = await loadStores()
    let finishFirst: (value: CGTCalculationResult) => void = () => {}
    processTransactionsFromDB
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve }))
      .mockResolvedValueOnce(results('2024/25'))

    const first = useTransactionStore.getState().recalculate()
    const second = useTransactionStore.getState().recalculate()
    await second
    expect(useTransactionStore.getState().isLoading).toBe(false)

    finishFirst(results('2020/21'))
    await first

    expect(useTransactionStore.getState().cgtResults?.taxYearSummaries[0].taxYear).toBe('2024/25')
    expect(useTransactionStore.getState().isLoading).toBe(false)
  })

  it('passes the current settings to the pipeline', async () => {
    const { useTransactionStore, useSettingsStore } = await loadStores()
    processTransactionsFromDB.mockResolvedValue(null)
    await useSettingsStore.getState().initializeFromDB()
    await useSettingsStore.getState().setFXSource('DAILY_SPOT')
    await useSettingsStore.getState().setAutoSplitsEnabled(false)

    await useTransactionStore.getState().recalculate()

    expect(processTransactionsFromDB).toHaveBeenCalledWith('DAILY_SPOT', false)
  })
})

describe('settingsStore', () => {
  it('loads settings from IndexedDB', async () => {
    settingsTable.set('fxSource', { key: 'fxSource', value: 'HMRC_YEARLY_AVG' })
    settingsTable.set('autoSplitsEnabled', { key: 'autoSplitsEnabled', value: 'false' })
    const { useSettingsStore } = await loadStores()

    await useSettingsStore.getState().initializeFromDB()

    expect(useSettingsStore.getState()).toMatchObject({
      fxSource: 'HMRC_YEARLY_AVG',
      autoSplitsEnabled: false,
      isInitialized: true,
    })
  })

  it('moves settings found only in legacy localStorage into IndexedDB', async () => {
    const { useSettingsStore, LEGACY_SETTINGS_KEY } = await loadStores()
    localStorage.setItem(LEGACY_SETTINGS_KEY, JSON.stringify({ state: { fxSource: 'DAILY_SPOT', autoSplitsEnabled: false }, version: 0 }))

    await useSettingsStore.getState().initializeFromDB()

    expect(useSettingsStore.getState().fxSource).toBe('DAILY_SPOT')
    expect(useSettingsStore.getState().autoSplitsEnabled).toBe(false)
    expect(settingsTable.get('fxSource')?.value).toBe('DAILY_SPOT')
    expect(settingsTable.get('autoSplitsEnabled')?.value).toBe('false')
    expect(localStorage.getItem(LEGACY_SETTINGS_KEY)).toBeNull()
  })

  it('prefers IndexedDB over the legacy copy', async () => {
    settingsTable.set('fxSource', { key: 'fxSource', value: 'HMRC_MONTHLY' })
    const { useSettingsStore, LEGACY_SETTINGS_KEY } = await loadStores()
    localStorage.setItem(LEGACY_SETTINGS_KEY, JSON.stringify({ state: { fxSource: 'DAILY_SPOT' } }))

    await useSettingsStore.getState().initializeFromDB()

    expect(useSettingsStore.getState().fxSource).toBe('HMRC_MONTHLY')
  })
})
