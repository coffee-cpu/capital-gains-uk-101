import { useEffect, useState } from 'react'
import { CSVImporter } from './components/CSVImporter'
import { TransactionList } from './components/TransactionList'
import { TaxYearSummary } from './components/TaxYearSummary'
import { Dashboard } from './components/Dashboard'
import { About } from './components/About'
import { Footer } from './components/Footer'
import { Sidebar } from './components/Sidebar'
import { FlowGuide } from './components/FlowGuide'
import { HelpPanel } from './components/HelpPanel'
import { SessionResumeDialog } from './components/SessionResumeDialog'
import { IssuesPanel } from './components/IssuesPanel'
import { MobileHeader } from './components/MobileHeader'
import { useTransactionStore } from './stores/transactionStore'
import { useSettingsStore, useInitializeSettings } from './stores/settingsStore'
import { db, clearAllData, ensureDatabaseCompatible } from './lib/db'
import { processTransactionsFromDB } from './lib/transactionProcessor'

function App() {
  const [currentPage, setCurrentPage] = useState<'calculator' | 'about'>('calculator')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showSessionDialog, setShowSessionDialog] = useState(false)
  const [dbReady, setDbReady] = useState(false)
  const [pendingTransactionCount, setPendingTransactionCount] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [fileSources, setFileSources] = useState<string[]>([])
  const setTransactions = useTransactionStore((state) => state.setTransactions)
  const setCGTResults = useTransactionStore((state) => state.setCGTResults)
  const setIsLoading = useTransactionStore((state) => state.setIsLoading)
  const fxSource = useSettingsStore((state) => state.fxSource)

  // Ensure database is compatible before anything else
  // (automatically clears incompatible schemas)
  useEffect(() => {
    ensureDatabaseCompatible().then(() => setDbReady(true))
  }, [])

  // Initialize settings from IndexedDB (only after DB is ready)
  useInitializeSettings()

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

  // Check for existing transactions on mount (only after DB is ready)
  useEffect(() => {
    if (!dbReady) return

    const checkExistingSession = async () => {
      const count = await db.transactions.count()
      if (count > 0) {
        setPendingTransactionCount(count)

        const files = await db.imported_files.toArray()

        const mostRecentFile = files
          .map(f => new Date(f.importedAt))
          .sort((a, b) => b.getTime() - a.getTime())[0]

        setLastUpdated(mostRecentFile || null)
        setFileSources(files.map(f => f.filename))

        setShowSessionDialog(true)
      }
    }
    checkExistingSession()
  }, [dbReady])

  // Load and process transactions from IndexedDB
  const loadTransactions = async () => {
    setIsLoading(true)
    try {
      const cgtResults = await processTransactionsFromDB(fxSource)
      if (cgtResults) {
        setTransactions(cgtResults.transactions)
        setCGTResults(cgtResults)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleContinueSession = async () => {
    setShowSessionDialog(false)
    await loadTransactions()
  }

  const handleStartFresh = async () => {
    setShowSessionDialog(false)
    await clearAllData()
  }

  // Render About page
  if (currentPage === 'about') {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar currentPage="about" isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 overflow-auto relative">
          <MobileHeader onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
          <About />
        </div>
      </div>
    )
  }

  // Render Calculator page
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar currentPage="calculator" isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-auto relative">
        <MobileHeader onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-grow">
          <div className="max-w-7xl mx-auto py-6 lg:py-12 px-4 sm:px-6 lg:px-8">
            <div className="space-y-8">
              <FlowGuide />
              <CSVImporter />
              <IssuesPanel />
              <TaxYearSummary />
              <Dashboard />
              <TransactionList />
            </div>
          </div>
        </main>

        <Footer />
      </div>

      {/* Help Panel (sticky sidebar on desktop, overlay on mobile) */}
      <HelpPanel />

      {/* Session resume dialog */}
      {showSessionDialog && (
        <SessionResumeDialog
          transactionCount={pendingTransactionCount}
          lastUpdated={lastUpdated}
          fileSources={fileSources}
          onContinue={handleContinueSession}
          onStartFresh={handleStartFresh}
        />
      )}
    </div>
  )
}

export default App
