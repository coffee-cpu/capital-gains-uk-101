import { useEffect } from 'react'
import { CSVImporter } from './components/CSVImporter'
import { TransactionList } from './components/TransactionList'
import { Footer } from './components/Footer'
import { useTransactionStore } from './stores/transactionStore'
import { db } from './lib/db'
import { deduplicateTransactions } from './utils/deduplication'
import { enrichTransactions } from './lib/enrichment'

function App() {
  const setTransactions = useTransactionStore((state) => state.setTransactions)

  // Load transactions from IndexedDB on mount
  useEffect(() => {
    const loadTransactions = async () => {
      const stored = await db.transactions.toArray()
      if (stored.length > 0) {
        // Deduplicate incomplete Stock Plan Activity when Equity Awards data exists
        const deduplicated = deduplicateTransactions(stored)

        // Enrich with FX rates and GBP conversions
        const enriched = await enrichTransactions(deduplicated)
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
              Capital Gains Tax UK 101
            </h1>
            <p className="text-xl text-gray-600">
              UK Capital Gains Tax made easy
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
