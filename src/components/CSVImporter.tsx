import { useState } from 'react'
import { parseCSV } from '../lib/csvParser'
import { detectBroker } from '../lib/brokerDetector'
import { normalizeSchwabTransactions } from '../lib/parsers/schwab'
import { normalizeSchwabEquityAwardsTransactions } from '../lib/parsers/schwabEquityAwards'
import { normalizeGenericTransactions } from '../lib/parsers/generic'
import { BrokerType } from '../types/broker'
import { GenericTransaction } from '../types/transaction'
import { useTransactionStore } from '../stores/transactionStore'
import { db } from '../lib/db'

export function CSVImporter() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedFormat, setExpandedFormat] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const addTransactions = useTransactionStore((state) => state.addTransactions)

  const processFile = async (file: File) => {

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
        case BrokerType.SCHWAB_EQUITY_AWARDS:
          transactions = normalizeSchwabEquityAwardsTransactions(rawRows, fileId)
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
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await processFile(file)
    // Reset file input
    event.target.value = ''
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)

    const file = event.dataTransfer.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    await processFile(file)
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
        {/* Drag and Drop Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={isProcessing}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />

          <div className="flex flex-col items-center">
            <svg
              className={`w-12 h-12 mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm font-medium text-gray-700 mb-1">
              Drop your CSV file here, or click to browse
            </p>
            <p className="text-xs text-gray-500">
              Supports Charles Schwab, Schwab Equity Awards, and Generic CSV
            </p>
          </div>
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
          <ul className="space-y-2">
            {/* Charles Schwab */}
            <li>
              <div className="flex items-center gap-2">
                <span>Charles Schwab</span>
                <button
                  onClick={() => setExpandedFormat(expandedFormat === 'schwab' ? null : 'schwab')}
                  className="text-blue-600 hover:text-blue-800 text-xs underline"
                >
                  {expandedFormat === 'schwab' ? 'hide' : 'instructions & example'}
                </button>
              </div>
              {expandedFormat === 'schwab' && (
                <div className="mt-2 ml-4 p-3 bg-gray-50 rounded text-xs space-y-2">
                  <p className="font-medium">How to download:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600">
                    <li>Log into schwab.com → Accounts → Transaction History</li>
                    <li>Select "Brokerage Accounts" from account dropdown</li>
                    <li>Select your account and date range (max 4 years)</li>
                    <li>Click Export → CSV</li>
                  </ol>
                  <p className="text-gray-600 italic">
                    Note: Schwab limits downloads to 4 years. For longer history, download in 4-year chunks and upload multiple files.
                  </p>
                  <a
                    href="/examples/schwab-transactions-example.csv"
                    className="inline-block text-blue-600 hover:text-blue-800 underline"
                  >
                    📥 Download example file
                  </a>
                </div>
              )}
            </li>

            {/* Charles Schwab Equity Awards */}
            <li>
              <div className="flex items-center gap-2">
                <span>Charles Schwab Equity Awards</span>
                <button
                  onClick={() => setExpandedFormat(expandedFormat === 'equity' ? null : 'equity')}
                  className="text-blue-600 hover:text-blue-800 text-xs underline"
                >
                  {expandedFormat === 'equity' ? 'hide' : 'instructions & example'}
                </button>
              </div>
              {expandedFormat === 'equity' && (
                <div className="mt-2 ml-4 p-3 bg-gray-50 rounded text-xs space-y-2">
                  <p className="font-medium">How to download:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600">
                    <li>Log into schwab.com → Accounts → Transaction History</li>
                    <li>Select "Other Accounts" → "Equity Award Center" from dropdown</li>
                    <li>Select your account and date range (max 4 years)</li>
                    <li>Click Export → CSV</li>
                  </ol>
                  <p className="text-gray-600 italic">
                    Note: Schwab limits downloads to 4 years. For longer history, download in 4-year chunks and upload multiple files.
                  </p>
                  <a
                    href="/examples/schwab-equity-awards-example.csv"
                    className="inline-block text-blue-600 hover:text-blue-800 underline"
                  >
                    📥 Download example file
                  </a>
                </div>
              )}
            </li>

            {/* Generic CSV */}
            <li>
              <div className="flex items-center gap-2">
                <span>Generic CSV</span>
                <button
                  onClick={() => setExpandedFormat(expandedFormat === 'generic' ? null : 'generic')}
                  className="text-blue-600 hover:text-blue-800 text-xs underline"
                >
                  {expandedFormat === 'generic' ? 'hide' : 'format & example'}
                </button>
              </div>
              {expandedFormat === 'generic' && (
                <div className="mt-2 ml-4 p-3 bg-gray-50 rounded text-xs space-y-2">
                  <p className="font-medium">Required columns:</p>
                  <p className="text-gray-600">date, type, symbol, currency</p>
                  <p className="font-medium mt-2">Optional columns:</p>
                  <p className="text-gray-600">name, quantity, price, total, fee, notes</p>
                  <a
                    href="/examples/generic-example.csv"
                    className="inline-block text-blue-600 hover:text-blue-800 underline"
                  >
                    📥 Download example file
                  </a>
                </div>
              )}
            </li>

            {/* Trading 212 */}
            <li className="text-gray-400">Trading 212 (coming soon)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
