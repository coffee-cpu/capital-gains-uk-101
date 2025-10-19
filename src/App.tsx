import { useEffect, useState } from 'react'
import { CSVImporter } from './components/CSVImporter'
import { TransactionList } from './components/TransactionList'
import { TaxYearSummary } from './components/TaxYearSummary'
import { About } from './components/About'
import { Footer } from './components/Footer'
import { Sidebar } from './components/Sidebar'
import { FlowGuide } from './components/FlowGuide'
import { useTransactionStore } from './stores/transactionStore'
import { db } from './lib/db'
import { deduplicateTransactions } from './utils/deduplication'
import { enrichTransactions } from './lib/enrichment'
import { calculateCGT } from './lib/cgt/engine'

function App() {
  const [currentPage, setCurrentPage] = useState<'calculator' | 'about'>('calculator')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
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
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar currentPage="about" isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 overflow-auto relative">
          {/* Mobile menu button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden absolute top-4 left-4 z-10 p-2 rounded-md bg-white border border-gray-300 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <About />
        </div>
      </div>
    )
  }

  // Render Calculator page
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar currentPage="calculator" isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-auto relative">
        {/* Mobile menu button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="lg:hidden absolute top-4 left-4 z-10 p-2 rounded-md bg-white border border-gray-300 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <main className="flex-grow">
          <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="space-y-8">
              <FlowGuide />
              <CSVImporter />
              <TaxYearSummary />
              <TransactionList />
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default App
