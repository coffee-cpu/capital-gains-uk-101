import { create } from 'zustand'
import { EnrichedTransaction } from '../types/transaction'
import { CGTCalculationResult, DisposalRecord, TaxYearSummary, Section104Pool } from '../types/cgt'
import { processTransactionsFromDB } from '../lib/transactionProcessor'
import { getTaxYear } from '../utils/taxYear'
import { useSettingsStore } from './settingsStore'

// Stable empty values, so selectors don't return a new reference each call
const EMPTY_TRANSACTIONS: EnrichedTransaction[] = []
const EMPTY_DISPOSALS: DisposalRecord[] = []
const EMPTY_POOLS: Map<string, Section104Pool> = new Map()

interface TransactionState {
  /** Result of the latest calculation; the single source of the transactions shown */
  cgtResults: CGTCalculationResult | null
  selectedTaxYear: string
  hasExportedPDF: boolean
  isLoading: boolean
  /**
   * True once this page session has started importing files, so data in
   * IndexedDB isn't mistaken for a previous session's
   */
  hasImportedThisSession: boolean
  /** Call before an import's first database write */
  markImportStarted: () => void
  setSelectedTaxYear: (year: string) => void
  setCGTResults: (results: CGTCalculationResult | null) => void
  setHasExportedPDF: (hasExported: boolean) => void
  /**
   * Re-run the full pipeline on the transactions in IndexedDB with the
   * current settings. When runs overlap (e.g. the FX source changes during
   * an import), only the latest one's result is applied.
   */
  recalculate: () => Promise<void>
  // Computed getters for CGT data
  getDisposals: () => DisposalRecord[]
  getTaxYearSummary: (taxYear: string) => TaxYearSummary | undefined
  getSection104Pools: () => Map<string, Section104Pool>
}

let latestRun = 0

/**
 * Zustand store for runtime transaction state and CGT calculations
 */
export const useTransactionStore = create<TransactionState>((set, get) => ({
  cgtResults: null,
  selectedTaxYear: getTaxYear(new Date()),
  hasExportedPDF: false,
  isLoading: false,
  hasImportedThisSession: false,

  markImportStarted: () => set({ hasImportedThisSession: true }),

  setSelectedTaxYear: (year) => set({ selectedTaxYear: year }),

  setCGTResults: (results) => {
    set({
      cgtResults: results,
      selectedTaxYear: chooseTaxYear(results, get().selectedTaxYear),
    })
  },

  setHasExportedPDF: (hasExported) => set({ hasExportedPDF: hasExported }),

  recalculate: async () => {
    const run = ++latestRun
    set({ isLoading: true })
    try {
      const settings = useSettingsStore.getState()
      await settings.initializeFromDB()
      const { fxSource, autoSplitsEnabled } = useSettingsStore.getState()
      const results = await processTransactionsFromDB(fxSource, autoSplitsEnabled)
      if (run === latestRun) get().setCGTResults(results)
    } finally {
      if (run === latestRun) set({ isLoading: false })
    }
  },

  getDisposals: () => get().cgtResults?.disposals ?? EMPTY_DISPOSALS,

  getTaxYearSummary: (taxYear: string) =>
    get().cgtResults?.taxYearSummaries.find(s => s.taxYear === taxYear),

  getSection104Pools: () => get().cgtResults?.section104Pools ?? EMPTY_POOLS,
}))

/** Selector for the calculated transactions (stable empty array when none) */
export const selectTransactions = (state: TransactionState): EnrichedTransaction[] =>
  state.cgtResults?.transactions ?? EMPTY_TRANSACTIONS

/**
 * Keep the year the user is viewing if the new results still have it;
 * otherwise show the most recent year with data.
 */
function chooseTaxYear(results: CGTCalculationResult | null, current: string): string {
  const summaries = results?.taxYearSummaries ?? []
  if (summaries.some(s => s.taxYear === current)) return current
  return summaries[0]?.taxYear ?? current
}
