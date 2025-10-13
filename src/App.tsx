import { useEffect, useState } from 'react'
import { CSVImporter } from './components/CSVImporter'
import { TransactionList } from './components/TransactionList'
import { TaxYearSummary } from './components/TaxYearSummary'
import { About } from './components/About'
import { Footer } from './components/Footer'
import { useTransactionStore } from './stores/transactionStore'
import { db } from './lib/db'
import { deduplicateTransactions } from './utils/deduplication'
import { enrichTransactions } from './lib/enrichment'
import { calculateCGT } from './lib/cgt/engine'

function App() {
  const [currentPage, setCurrentPage] = useState<'calculator' | 'about'>('calculator')
  const setTransactions = useTransactionStore((state) => state.setTransactions)
  const setCGTResults = useTransactionStore((state) => state.setCGTResults)

  // Handle hash-based routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) // Remove the '#'
      setCurrentPage(hash === 'about' ? 'about' : 'calculator')
    }

    // Set initial page based on hash
    handleHashChange()

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Load transactions from IndexedDB on mount
  useEffect(() => {
    const loadTransactions = async () => {
      const stored = await db.transactions.toArray()
      if (stored.length > 0) {
        // Deduplicate incomplete Stock Plan Activity when Equity Awards data exists
        const deduplicated = deduplicateTransactions(stored)

        // Enrich with FX rates and GBP conversions
        const enriched = await enrichTransactions(deduplicated)

        // Calculate CGT with HMRC matching rules
        const cgtResults = calculateCGT(enriched)

        // Update store with enriched transactions and CGT results
        setTransactions(cgtResults.transactions)
        setCGTResults(cgtResults)
      }
    }
    loadTransactions()
  }, [setTransactions, setCGTResults])

  // Render About page
  if (currentPage === 'about') {
    return <About />
  }

  // Render Calculator page
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
            <div className="mt-4">
              <a
                href="#about"
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                About this calculator
              </a>
            </div>
          </div>

          <div className="space-y-8">
            <CSVImporter />
            <TaxYearSummary />
            <TransactionList />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default App
