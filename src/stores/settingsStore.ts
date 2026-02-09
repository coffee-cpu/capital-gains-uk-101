import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { FXSource, DEFAULT_FX_SOURCE } from '../types/fxSource'
import { db } from '../lib/db'

interface SettingsState {
  // FX Source
  fxSource: FXSource
  setFXSource: (fxSource: FXSource) => Promise<void>

  // Auto-splits
  autoSplitsEnabled: boolean
  setAutoSplitsEnabled: (enabled: boolean) => Promise<void>

  // Track if settings have been loaded from IndexedDB
  isInitialized: boolean
  initializeFromDB: () => Promise<void>
}

/**
 * Zustand store for user settings
 *
 * Settings are persisted to both localStorage (for fast initial load)
 * and IndexedDB (for consistency with transaction data)
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      fxSource: DEFAULT_FX_SOURCE,
      autoSplitsEnabled: true,
      isInitialized: false,

      setFXSource: async (fxSource: FXSource) => {
        set({ fxSource: fxSource })

        // Also persist to IndexedDB for consistency
        try {
          await db.settings.put({
            key: 'fxSource',
            value: fxSource,
            updatedAt: new Date().toISOString(),
          })
        } catch (error) {
          console.error('Failed to persist FX source to IndexedDB:', error)
        }
      },

      setAutoSplitsEnabled: async (enabled: boolean) => {
        set({ autoSplitsEnabled: enabled })

        try {
          await db.settings.put({
            key: 'autoSplitsEnabled',
            value: String(enabled),
            updatedAt: new Date().toISOString(),
          })
        } catch (error) {
          console.error('Failed to persist autoSplitsEnabled to IndexedDB:', error)
        }
      },

      initializeFromDB: async () => {
        if (get().isInitialized) return

        try {
          const fxSetting = await db.settings.get('fxSource')
          if (fxSetting?.value) {
            const validSources: FXSource[] = ['HMRC_MONTHLY', 'HMRC_YEARLY_AVG', 'DAILY_SPOT']
            if (validSources.includes(fxSetting.value as FXSource)) {
              set({ fxSource: fxSetting.value as FXSource })
            }
          }

          const autoSplitsSetting = await db.settings.get('autoSplitsEnabled')
          if (autoSplitsSetting?.value) {
            set({ autoSplitsEnabled: autoSplitsSetting.value !== 'false' })
          }
        } catch (error) {
          console.error('Failed to load settings from IndexedDB:', error)
        }

        set({ isInitialized: true })
      },
    }),
    {
      name: 'cgt-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        fxSource: state.fxSource,
        autoSplitsEnabled: state.autoSplitsEnabled,
      }),
    }
  )
)

/**
 * Hook to ensure settings are initialized from DB
 * Call this in App or a layout component
 */
export function useInitializeSettings(): void {
  const { isInitialized, initializeFromDB } = useSettingsStore()

  if (!isInitialized) {
    // Fire and forget - the store will update when ready
    initializeFromDB()
  }
}
