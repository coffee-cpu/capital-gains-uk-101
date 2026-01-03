import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { FXStrategy, DEFAULT_FX_STRATEGY } from '../types/fxStrategy'
import { db } from '../lib/db'

interface SettingsState {
  // FX Strategy
  fxStrategy: FXStrategy
  setFXStrategy: (strategy: FXStrategy) => Promise<void>

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
      fxStrategy: DEFAULT_FX_STRATEGY,
      isInitialized: false,

      setFXStrategy: async (strategy: FXStrategy) => {
        set({ fxStrategy: strategy })

        // Also persist to IndexedDB for consistency
        try {
          await db.settings.put({
            key: 'fxStrategy',
            value: strategy,
            updatedAt: new Date().toISOString(),
          })
        } catch (error) {
          console.error('Failed to persist FX strategy to IndexedDB:', error)
        }
      },

      initializeFromDB: async () => {
        if (get().isInitialized) return

        try {
          const setting = await db.settings.get('fxStrategy')
          if (setting?.value) {
            // Validate the value is a valid strategy
            const validStrategies: FXStrategy[] = ['HMRC_MONTHLY', 'HMRC_YEARLY_AVG', 'DAILY_SPOT']
            if (validStrategies.includes(setting.value as FXStrategy)) {
              set({ fxStrategy: setting.value as FXStrategy })
            }
          }
        } catch (error) {
          console.error('Failed to load FX strategy from IndexedDB:', error)
        }

        set({ isInitialized: true })
      },
    }),
    {
      name: 'cgt-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        fxStrategy: state.fxStrategy,
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
