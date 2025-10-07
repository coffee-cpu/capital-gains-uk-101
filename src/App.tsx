import { CSVImporter } from './components/CSVImporter'
import { TransactionList } from './components/TransactionList'
import { Footer } from './components/Footer'

function App() {
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
