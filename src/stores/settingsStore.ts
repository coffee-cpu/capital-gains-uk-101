import { create } from 'zustand'
import { FXSource, FXSourceSchema, DEFAULT_FX_SOURCE } from '../types/fxSource'
import { db } from '../lib/db'

interface SettingsState {
  fxSource: FXSource
  setFXSource: (fxSource: FXSource) => Promise<void>

  autoSplitsEnabled: boolean
  setAutoSplitsEnabled: (enabled: boolean) => Promise<void>

  /** True once settings have been read from IndexedDB */
  isInitialized: boolean
  /**
   * Load settings from IndexedDB. Safe to call more than once: every call
   * returns the same promise, so callers can await it before using settings.
   */
  initializeFromDB: () => Promise<void>
}

/**
 * Settings were persisted to localStorage under this key (Zustand persist)
 * before IndexedDB became their only store. Read once to migrate them.
 */
export const LEGACY_SETTINGS_KEY = 'cgt-settings'

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

type StoredSettings = Partial<Pick<SettingsState, 'fxSource' | 'autoSplitsEnabled'>>

async function loadSettings(): Promise<StoredSettings> {
  const settings: StoredSettings = {}
  try {
    const fxSetting = await db.settings.get('fxSource')
    if (isFXSource(fxSetting?.value)) settings.fxSource = fxSetting.value

    const autoSplitsSetting = await db.settings.get('autoSplitsEnabled')
    if (autoSplitsSetting?.value) settings.autoSplitsEnabled = autoSplitsSetting.value !== 'false'
  } catch (error) {
    console.error('Failed to load settings from IndexedDB:', error)
  }

  return { ...(await migrateLegacySettings(settings)), ...settings }
}

/**
 * Move settings that exist only in the legacy localStorage copy into
 * IndexedDB, then drop the localStorage copy. IndexedDB wins where both exist.
 */
async function migrateLegacySettings(stored: StoredSettings): Promise<StoredSettings> {
  const legacy: StoredSettings = {}
  try {
    const raw = localStorage.getItem(LEGACY_SETTINGS_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    const state = (parsed as { state?: Record<string, unknown> } | null)?.state ?? {}
    if (isFXSource(state.fxSource)) legacy.fxSource = state.fxSource
    if (typeof state.autoSplitsEnabled === 'boolean') legacy.autoSplitsEnabled = state.autoSplitsEnabled
  } catch {
    return {}
  }

  // Only drop the legacy copy once everything it holds is in IndexedDB
  let saved = true
  if (legacy.fxSource && !stored.fxSource) saved = await saveSetting('fxSource', legacy.fxSource)
  if (legacy.autoSplitsEnabled !== undefined && stored.autoSplitsEnabled === undefined) {
    saved = (await saveSetting('autoSplitsEnabled', String(legacy.autoSplitsEnabled))) && saved
  }
  if (saved) {
    try {
      localStorage.removeItem(LEGACY_SETTINGS_KEY)
    } catch {
      // Storage unavailable: the copy is read again next time
    }
  }
  return legacy
}

/** Persist one setting; false if IndexedDB refused the write */
async function saveSetting(key: string, value: string): Promise<boolean> {
  try {
    await db.settings.put({ key, value, updatedAt: new Date().toISOString() })
    return true
  } catch (error) {
    console.error(`Failed to persist setting ${key} to IndexedDB:`, error)
    return false
  }
}

function isFXSource(value: unknown): value is FXSource {
  return FXSourceSchema.safeParse(value).success
}
