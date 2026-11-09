import { create } from 'zustand'
import { HelpContext } from '../utils/helpContent'

interface HelpPanelState {
  isOpen: boolean
  context: HelpContext
  setOpen: (open: boolean) => void
  /** Open the panel on this context, or close it if it's already showing it */
  toggleWithContext: (context: HelpContext) => void
}

/**
 * UI state for the help side panel. Always starts closed on page load.
 */
export const useHelpPanelStore = create<HelpPanelState>((set, get) => ({
  isOpen: false,
  context: 'default',

  setOpen: (open) => set({ isOpen: open }),

  toggleWithContext: (context) => {
    const { isOpen, context: current } = get()
    if (isOpen && current === context) {
      set({ isOpen: false })
    } else {
      set({ context, isOpen: true })
    }
  },
}))
