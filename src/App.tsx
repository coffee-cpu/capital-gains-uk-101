import { useEffect } from 'react'
import { CSVImporter } from './components/CSVImporter'
import { TransactionList } from './components/TransactionList'
import { Footer } from './components/Footer'
import { useTransactionStore } from './stores/transactionStore'
import { db } from './lib/db'

function App() {
  const setTransactions = useTransactionStore((state) => state.setTransactions)

  // Load transactions from IndexedDB on mount
  useEffect(() => {
    const loadTransactions = async () => {
      const stored = await db.transactions.toArray()
      if (stored.length > 0) {
        // Convert to EnrichedTransaction format (for now, without enrichment)
        const enriched = stored.map(tx => ({
          ...tx,
          fx_rate: 1,
          price_gbp: tx.price,
          value_gbp: tx.total,
          fee_gbp: tx.fee,
          fx_source: 'Not yet enriched',
          tax_year: '2024/25',
          gain_group: 'NONE' as const,
        }))
        setTransactions(enriched)
      }
    }
    loadTransactions()
  }, [setTransactions])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              CGT Visualizer
            </h1>
            <p className="text-xl text-gray-600">
              UK Capital Gains Tax Calculator
            </p>
          </div>

          <div className="space-y-8">
            <CSVImporter />
            <TransactionList />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default App
