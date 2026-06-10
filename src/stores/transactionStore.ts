import { create } from 'zustand'
import { EnrichedTransaction } from '../types/transaction'
import { CGTCalculationResult, DisposalRecord, TaxYearSummary, Section104Pool } from '../types/cgt'
import { HelpContext } from '../utils/helpContent'

interface TransactionState {
  transactions: EnrichedTransaction[]
  selectedTaxYear: string
  cgtResults: CGTCalculationResult | null
  hasExportedPDF: boolean
  isLoading: boolean
  // Help panel state
  isHelpPanelOpen: boolean
  helpContext: HelpContext
  setTransactions: (transactions: EnrichedTransaction[]) => void
  setSelectedTaxYear: (year: string) => void
  setCGTResults: (results: CGTCalculationResult) => void
  setHasExportedPDF: (hasExported: boolean) => void
  setIsLoading: (isLoading: boolean) => void
  // Help panel actions
  setHelpPanelOpen: (open: boolean) => void
  toggleHelpPanelWithContext: (context: HelpContext) => void
  // Computed getters for CGT data
  getDisposals: () => DisposalRecord[]
  getTaxYearSummary: (taxYear: string) => TaxYearSummary | undefined
  getSection104Pools: () => Map<string, Section104Pool>
}

/**
 * Zustand store for runtime transaction state and CGT calculations
 */
export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  selectedTaxYear: '2024/25',
  cgtResults: null,
  hasExportedPDF: false,
  isLoading: false,
  isHelpPanelOpen: false, // Always start closed on page load
  helpContext: 'default',

  setTransactions: (transactions) => set({ transactions }),

  setSelectedTaxYear: (year) => set({ selectedTaxYear: year }),

  setCGTResults: (results) => {
    // Automatically select the most recent tax year with data
    const mostRecentTaxYear = results.taxYearSummaries.length > 0
      ? results.taxYearSummaries[0].taxYear
      : get().selectedTaxYear

    set({
      cgtResults: results,
      selectedTaxYear: mostRecentTaxYear
    })
  },

  setHasExportedPDF: (hasExported) => set({ hasExportedPDF: hasExported }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setHelpPanelOpen: (open) => set({ isHelpPanelOpen: open }),

  toggleHelpPanelWithContext: (context) => {
    const state = get()
    // If panel is open and showing the same context, close it
    if (state.isHelpPanelOpen && state.helpContext === context) {
      set({ isHelpPanelOpen: false })
    } else {
      // Otherwise, open panel with this context (or switch context if already open)
      set({ helpContext: context, isHelpPanelOpen: true })
    }
  },

  // Computed getters
  getDisposals: () => get().cgtResults?.disposals ?? [],

  getTaxYearSummary: (taxYear: string) =>
    get().cgtResults?.taxYearSummaries.find(s => s.taxYear === taxYear),

  getSection104Pools: () => get().cgtResults?.section104Pools ?? new Map(),
}))
