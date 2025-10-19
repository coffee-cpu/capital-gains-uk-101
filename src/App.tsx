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
          {/* Mobile header */}
          <header className="lg:hidden sticky top-0 z-10 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Toggle menu"
              >
                <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Logo and title */}
              <div className="flex items-center gap-2 flex-1">
                <img
                  src="/favicon/favicon.svg"
                  alt="Logo"
                  className="w-8 h-8 flex-shrink-0"
                />
                <div className="flex flex-col">
                  <div className="text-sm font-bold leading-tight">
                    <span className="text-blue-600">C</span>
                    <span className="text-gray-900">apital </span>
                    <span className="text-blue-600">G</span>
                    <span className="text-gray-900">ains </span>
                    <span className="text-blue-600">T</span>
                    <span className="text-gray-900">ax</span>
                  </div>
                  <div className="text-xs font-semibold text-gray-600">
                    Visualiser
                  </div>
                </div>
              </div>
            </div>
          </header>
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
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-10 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Logo and title */}
            <div className="flex items-center gap-2 flex-1">
              <img
                src="/favicon/favicon.svg"
                alt="Logo"
                className="w-8 h-8 flex-shrink-0"
              />
              <div className="flex flex-col">
                <div className="text-sm font-bold leading-tight">
                  <span className="text-blue-600">C</span>
                  <span className="text-gray-900">apital </span>
                  <span className="text-blue-600">G</span>
                  <span className="text-gray-900">ains </span>
                  <span className="text-blue-600">T</span>
                  <span className="text-gray-900">ax</span>
                </div>
                <div className="text-xs font-semibold text-gray-600">
                  Visualiser
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-grow">
          <div className="max-w-7xl mx-auto py-6 lg:py-12 px-4 sm:px-6 lg:px-8">
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
