import { create } from 'zustand'

export type TransactionFilterMode = 'all' | 'attention'

interface TransactionFilterState {
  /** 'attention' shows only the rows that need attention (the "Needs attention" button) */
  filterMode: TransactionFilterMode
  search: string
  /** 'all' or a key of the transaction list's type groups */
  typeGroup: string
  taxYear: string
  setFilterMode: (mode: TransactionFilterMode) => void
  setSearch: (search: string) => void
  setTypeGroup: (typeGroup: string) => void
  setTaxYear: (taxYear: string) => void
  clearFilters: () => void
  /** Only the rows needing attention, with the other filters cleared so none of them is hidden */
  showAttention: () => void
}

const CLEARED = { filterMode: 'all', search: '', typeGroup: 'all', taxYear: 'all' } as const

/**
 * The transaction list's filters. Kept in a store so the Issues panel's links
 * can show the flagged rows before scrolling to the list.
 */
export const useTransactionFilterStore = create<TransactionFilterState>((set) => ({
  ...CLEARED,
  setFilterMode: (filterMode) => set({ filterMode }),
  setSearch: (search) => set({ search }),
  setTypeGroup: (typeGroup) => set({ typeGroup }),
  setTaxYear: (taxYear) => set({ taxYear }),
  clearFilters: () => set(CLEARED),
  showAttention: () => set({ ...CLEARED, filterMode: 'attention' }),
}))
