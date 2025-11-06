import { create } from 'zustand'
import { GenericTransaction, EnrichedTransaction } from '../types/transaction'
import { CGTCalculationResult, DisposalRecord, TaxYearSummary, Section104Pool } from '../types/cgt'
import { HelpContext } from '../utils/helpContent'

interface TransactionState {
  transactions: EnrichedTransaction[]
  selectedTaxYear: string
  cgtResults: CGTCalculationResult | null
  hasExportedPDF: boolean
  // Help panel state
  isHelpPanelOpen: boolean
  helpContext: HelpContext
  setTransactions: (transactions: EnrichedTransaction[]) => void
  setSelectedTaxYear: (year: string) => void
  setCGTResults: (results: CGTCalculationResult) => void
  addTransactions: (transactions: GenericTransaction[]) => void
  setHasExportedPDF: (hasExported: boolean) => void
  // Help panel actions
  setHelpPanelOpen: (open: boolean) => void
  setHelpContext: (context: HelpContext) => void
  toggleHelpPanel: () => void
  // Computed getters for CGT data
  getDisposals: () => DisposalRecord[]
  getTaxYearSummary: (taxYear: string) => TaxYearSummary | undefined
  getSection104Pools: () => Map<string, Section104Pool>
}

/**
 * Load help panel state from localStorage
 */
function loadHelpPanelState(): boolean {
  try {
    const stored = localStorage.getItem('helpPanelOpen')
    return stored !== null ? JSON.parse(stored) : true // Default to open
  } catch {
    return true
  }
}

/**
 * Save help panel state to localStorage
 */
function saveHelpPanelState(isOpen: boolean): void {
  try {
    localStorage.setItem('helpPanelOpen', JSON.stringify(isOpen))
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Zustand store for runtime transaction state and CGT calculations
 */
export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  selectedTaxYear: '2024/25',
  cgtResults: null,
  hasExportedPDF: false,
  isHelpPanelOpen: loadHelpPanelState(),
  helpContext: 'default',

  setTransactions: (transactions) => set({ transactions }),

  setSelectedTaxYear: (year) => set({ selectedTaxYear: year }),

  setCGTResults: (results) => set({ cgtResults: results }),

  setHasExportedPDF: (hasExported) => set({ hasExportedPDF: hasExported }),

  setHelpPanelOpen: (open) => {
    saveHelpPanelState(open)
    set({ isHelpPanelOpen: open })
  },

  setHelpContext: (context) => set({ helpContext: context }),

  toggleHelpPanel: () => {
    const newState = !get().isHelpPanelOpen
    saveHelpPanelState(newState)
    set({ isHelpPanelOpen: newState })
  },

  addTransactions: (newTransactions) =>
    set((state) => ({
      transactions: [
        ...state.transactions,
        ...newTransactions.map(tx => ({
          ...tx,
          fx_rate: 1, // Will be enriched later
          price_gbp: tx.price,
          value_gbp: tx.total,
          fee_gbp: tx.fee,
          fx_source: 'Not yet enriched',
          fx_error: null,
          tax_year: '2024/25',
          gain_group: 'NONE' as const,
        })),
      ],
    })),

  // Computed getters
  getDisposals: () => get().cgtResults?.disposals ?? [],

  getTaxYearSummary: (taxYear: string) =>
    get().cgtResults?.taxYearSummaries.find(s => s.taxYear === taxYear),

  getSection104Pools: () => get().cgtResults?.section104Pools ?? new Map(),
}))
