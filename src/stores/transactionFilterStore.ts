import { create } from 'zustand'

export type TransactionFilterMode = 'all' | 'attention'

interface TransactionFilterState {
  /** 'attention' shows only the rows that need attention (the "Needs attention" button) */
  filterMode: TransactionFilterMode
  setFilterMode: (mode: TransactionFilterMode) => void
}

/**
 * The transaction list's "Needs attention" filter. Kept in a store so the
 * Issues panel's links can turn it on before scrolling to the list.
 */
export const useTransactionFilterStore = create<TransactionFilterState>((set) => ({
  filterMode: 'all',
  setFilterMode: (filterMode) => set({ filterMode }),
}))
