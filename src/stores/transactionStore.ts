import { create } from 'zustand'
import { GenericTransaction, EnrichedTransaction } from '../types/transaction'

interface TransactionState {
  transactions: EnrichedTransaction[]
  selectedTaxYear: string
  setTransactions: (transactions: EnrichedTransaction[]) => void
  setSelectedTaxYear: (year: string) => void
  addTransactions: (transactions: GenericTransaction[]) => void
}

/**
 * Zustand store for runtime transaction state
 */
export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  selectedTaxYear: '2024/25',

  setTransactions: (transactions) => set({ transactions }),

  setSelectedTaxYear: (year) => set({ selectedTaxYear: year }),

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
          tax_year: '2024/25',
          gain_group: 'NONE' as const,
        })),
      ],
    })),
}))
