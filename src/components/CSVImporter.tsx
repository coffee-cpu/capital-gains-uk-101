import { useState } from 'react'
import { parseCSV } from '../lib/csvParser'
import { detectBroker } from '../lib/brokerDetector'
import { normalizeSchwabTransactions } from '../lib/parsers/schwab'
import { normalizeGenericTransactions } from '../lib/parsers/generic'
import { BrokerType } from '../types/broker'
import { GenericTransaction } from '../types/transaction'
import { useTransactionStore } from '../stores/transactionStore'
import { db } from '../lib/db'

export function CSVImporter() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const addTransactions = useTransactionStore((state) => state.addTransactions)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      // Parse CSV first
      const rawRows = await parseCSV(file)
      const headers = Object.keys(rawRows[0] || {})

      // Generate unique file identifier
      const fileId = `${file.name.replace(/[^a-z0-9]/gi, '_')}-${file.size}`

      // Check for duplicates
      const existingWithFileId = await db.transactions
        .where('id')
        .startsWith(fileId)
        .count()

      if (existingWithFileId > 0) {
        setSuccess(`This file "${file.name}" was already imported. No new transactions added.`)
        return
      }

      // Try to detect broker format
      const detection = detectBroker(rawRows)

      if (detection.confidence < 0.8) {
        throw new Error(`Could not detect CSV format (confidence: ${(detection.confidence * 100).toFixed(0)}%). Please check your CSV file format.`)
      }

      let transactions: GenericTransaction[] = []

      switch (detection.broker) {
        case BrokerType.SCHWAB:
          transactions = normalizeSchwabTransactions(rawRows, fileId)
          break
        case BrokerType.GENERIC:
          transactions = normalizeGenericTransactions(rawRows, fileId)
          break
        case BrokerType.TRADING212:
          throw new Error('Trading 212 format not yet supported')
        default:
          throw new Error(`Unsupported broker: ${detection.broker}`)
      }

      if (transactions.length === 0) {
        throw new Error('No valid transactions found in CSV')
      }

      await saveTransactions(transactions, detection.broker)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import CSV')
    } finally {
      setIsProcessing(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const saveTransactions = async (transactions: GenericTransaction[], source: string) => {
    await db.transactions.bulkAdd(transactions)
    addTransactions(transactions)
    setSuccess(`Successfully imported ${transactions.length} transactions from ${source}`)
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Import Transactions</h2>

      <div className="space-y-4">

          <div>
            <label
              htmlFor="csv-upload"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Upload CSV file from your broker
            </label>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isProcessing}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {isProcessing && (
            <div className="flex items-center text-blue-600">
              <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing CSV...
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Import Error</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Success</h3>
                  <div className="mt-2 text-sm text-green-700">{success}</div>
                </div>
              </div>
            </div>
          )}

        <div className="text-sm text-gray-500">
          <p className="mb-2">Supported formats (auto-detected):</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Charles Schwab</li>
            <li>Generic CSV (columns: date, type, symbol, currency + optional fields)</li>
            <li className="text-gray-400">Trading 212 (coming soon)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
