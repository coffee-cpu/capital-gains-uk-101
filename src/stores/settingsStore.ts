import { create } from 'zustand'
import { FXSource, FXSourceSchema, DEFAULT_FX_SOURCE } from '../types/fxSource'
import { db } from '../lib/db'
import { isTransactionHistoryScope, type TransactionHistoryScope } from '../lib/pdf/cgtReportDocument'

interface SettingsState {
  fxSource: FXSource
  setFXSource: (fxSource: FXSource) => Promise<void>

  autoSplitsEnabled: boolean
  setAutoSplitsEnabled: (enabled: boolean) => Promise<void>

  /** The PDF report's transaction history appendix */
  pdfTransactionHistory: TransactionHistoryScope
  setPdfTransactionHistory: (scope: TransactionHistoryScope) => Promise<void>

  /** True once settings have been read from IndexedDB */
  isInitialized: boolean
  /**
   * Load settings from IndexedDB. Safe to call more than once: every call
   * returns the same promise, so callers can await it before using settings.
   */
  initializeFromDB: () => Promise<void>
}

let initialization: Promise<void> | null = null

/** Settings the user changed while they were loading; loading must not overwrite them */
const changedDuringLoad = new Set<keyof StoredSettings>()

/**
 * Zustand store for user settings. IndexedDB (`settings` table) is the only
 * persisted copy; this store holds the values in memory once loaded.
 */
export const useSettingsStore = create<SettingsState>()((set) => ({
  fxSource: DEFAULT_FX_SOURCE,
  autoSplitsEnabled: true,
  pdfTransactionHistory: 'none',
  isInitialized: false,

  setFXSource: async (fxSource) => {
    changedDuringLoad.add('fxSource')
    set({ fxSource })
    await saveSetting('fxSource', fxSource)
  },

  setAutoSplitsEnabled: async (enabled) => {
    changedDuringLoad.add('autoSplitsEnabled')
    set({ autoSplitsEnabled: enabled })
    await saveSetting('autoSplitsEnabled', String(enabled))
  },

  setPdfTransactionHistory: async (scope) => {
    changedDuringLoad.add('pdfTransactionHistory')
    set({ pdfTransactionHistory: scope })
    await saveSetting('pdfTransactionHistory', scope)
  },

  initializeFromDB: () => {
    if (!initialization) {
      changedDuringLoad.clear()
      initialization = loadSettings().then(settings => {
        for (const key of changedDuringLoad) delete settings[key]
        set({ ...settings, isInitialized: true })
      })
    }
    return initialization
  },
}))

type StoredSettings = Partial<Pick<SettingsState, 'fxSource' | 'autoSplitsEnabled' | 'pdfTransactionHistory'>>

async function loadSettings(): Promise<StoredSettings> {
  const settings: StoredSettings = {}
  try {
    const fxSetting = await db.settings.get('fxSource')
    if (isFXSource(fxSetting?.value)) settings.fxSource = fxSetting.value

    const autoSplitsSetting = await db.settings.get('autoSplitsEnabled')
    if (autoSplitsSetting?.value) settings.autoSplitsEnabled = autoSplitsSetting.value !== 'false'

    const historySetting = await db.settings.get('pdfTransactionHistory')
    if (isTransactionHistoryScope(historySetting?.value)) settings.pdfTransactionHistory = historySetting.value
  } catch (error) {
    console.error('Failed to load settings from IndexedDB:', error)
  }
  return settings
}

async function saveSetting(key: string, value: string): Promise<void> {
  try {
    await db.settings.put({ key, value, updatedAt: new Date().toISOString() })
  } catch (error) {
    console.error(`Failed to persist setting ${key} to IndexedDB:`, error)
  }
}

function isFXSource(value: unknown): value is FXSource {
  return FXSourceSchema.safeParse(value).success
}
