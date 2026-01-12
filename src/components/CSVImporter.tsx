import { useState } from 'react'
import { parseCSV, isCoinbaseCSV, stripCoinbaseMetadataRows } from '../lib/csvParser'
import { detectBroker } from '../lib/brokerDetector'
import { getParser } from '../lib/parsers/parserRegistry'
import { GenericTransaction } from '../types/transaction'
import { useTransactionStore } from '../stores/transactionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { db } from '../lib/db'
import { processTransactionsFromDB } from '../lib/transactionProcessor'
import { normalizeTransactionSymbols } from '../utils/symbolNormalization'

export function CSVImporter() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedFormat, setExpandedFormat] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showImportInfo, setShowImportInfo] = useState(false)
  const [showFormats, setShowFormats] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const setTransactions = useTransactionStore((state) => state.setTransactions)
  const setCGTResults = useTransactionStore((state) => state.setCGTResults)
  const fxSource = useSettingsStore((state) => state.fxSource)

  const processFile = async (file: File): Promise<{ success: boolean; message: string; count?: number }> => {
    try {
      // Check if this is a Coinbase file (needs special handling for metadata rows)
      const isCoinbase = await isCoinbaseCSV(file)

      // For Coinbase files, strip the first 2 metadata rows before parsing
      const fileToProcess = isCoinbase ? await stripCoinbaseMetadataRows(file) : file

      // Parse CSV using the standard parser
      const rawRows = await parseCSV(fileToProcess)

      // Generate unique file identifier
      const fileId = `${file.name.replace(/[^a-z0-9]/gi, '_')}-${file.size}`

      // Check for duplicates
      const existingWithFileId = await db.transactions
        .where('id')
        .startsWith(fileId)
        .count()

      if (existingWithFileId > 0) {
        return {
          success: true,
          message: `"${file.name}" was already imported (skipped)`,
          count: 0
        }
      }

      // Try to detect broker format
      const detection = detectBroker(rawRows)

      if (detection.confidence < 0.8) {
        throw new Error(`Could not detect CSV format (confidence: ${(detection.confidence * 100).toFixed(0)}%). Please check your CSV file format.`)
      }

      // Get parser for detected broker
      const parser = getParser(detection.broker)
      if (!parser) {
        throw new Error(`Unsupported broker: ${detection.broker}`)
      }

      let transactions: GenericTransaction[] = parser(rawRows, fileId)

      if (transactions.length === 0) {
        throw new Error('No valid transactions found in CSV')
      }

      // Apply symbol normalization (e.g., FB -> META)
      transactions = normalizeTransactionSymbols(transactions)

      // Add import timestamp
      const importedAt = new Date().toISOString()
      transactions = transactions.map(tx => ({ ...tx, imported_at: importedAt }))

      // Store file metadata
      await db.imported_files.add({
        fileId,
        filename: file.name,
        broker: detection.broker,
        transactionCount: transactions.length,
        importedAt
      })

      await db.transactions.bulkAdd(transactions)

      return {
        success: true,
        message: `"${file.name}": ${transactions.length} transactions from ${detection.broker}`,
        count: transactions.length
      }
    } catch (err) {
      return {
        success: false,
        message: `"${file.name}": ${err instanceof Error ? err.message : 'Failed to import'}`,
        count: 0
      }
    }
  }

  const processFiles = async (files: File[]) => {
    setIsProcessing(true)
    setError(null)
    setSuccess(null)
    setProcessingStatus('')

    const results = []
    let totalTransactions = 0
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProcessingStatus(`Processing file ${i + 1} of ${files.length}: ${file.name}...`)

      const result = await processFile(file)
      results.push(result)

      if (result.success) {
        successCount++
        totalTransactions += result.count || 0
      } else {
        failCount++
      }
    }

    // Process all transactions from DB (deduplicate, enrich, calculate CGT)
    const cgtResults = await processTransactionsFromDB(fxSource)
    if (cgtResults) {
      setTransactions(cgtResults.transactions)
      setCGTResults(cgtResults)
    }

    setIsProcessing(false)
    setProcessingStatus('')

    // Show summary
    if (failCount > 0) {
      const errorMessages = results
        .filter(r => !r.success)
        .map(r => r.message)
        .join('\n')
      setError(`${failCount} file(s) failed:\n${errorMessages}`)
    }

    if (successCount > 0) {
      const successMessages = results
        .filter(r => r.success)
        .map(r => r.message)
        .join('\n')
      setSuccess(`${successCount} file(s) imported successfully (${totalTransactions} total transactions):\n${successMessages}`)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList)
    await processFiles(files)

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

    const fileList = event.dataTransfer.files
    if (!fileList || fileList.length === 0) return

    // Filter only CSV files
    const files = Array.from(fileList).filter(file => file.name.endsWith('.csv'))

    if (files.length === 0) {
      setError('Please upload CSV files only')
      return
    }

    if (files.length < fileList.length) {
      setError(`Skipped ${fileList.length - files.length} non-CSV file(s). Processing ${files.length} CSV file(s)...`)
      // Still process the valid CSV files
    }

    await processFiles(files)
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Import Transactions</h2>
          <p className="text-xs text-gray-500 mt-1">All processing happens locally in your browser — your data never leaves your device</p>
        </div>
        <button
          onClick={() => setShowImportInfo(!showImportInfo)}
          className="text-sm text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          What to import?
        </button>
      </div>

      {showImportInfo && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">What to import</h3>
              <div className="mt-2 text-sm text-blue-700 space-y-2">
                <p>You need to provide the transaction history for <strong>each of your accounts</strong>.</p>
                <p>The history should include <strong>ALL transactions</strong> since you first acquired any shares owned during the relevant tax years (even if they were acquired in previous years).</p>
                <p className="text-blue-600 bg-blue-100 p-2 rounded">
                  <strong>Why historical data?</strong> To calculate your gain/loss, we need to know the original purchase price (cost basis) of shares you sold. This requires transaction history from when you first bought them, which may be years ago.
                </p>
                <p className="italic">The calculation is possible once you've gathered all transactions from all your brokers.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Drag and Drop Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            multiple
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
              Drop your CSV files here, or click to browse
            </p>
            <p className="text-xs text-gray-500">
              Supports multiple files • Charles Schwab, Schwab Equity Awards, Interactive Brokers, Freetrade, Trading 212, EquatePlus, Revolut, Coinbase, and Generic CSV
            </p>
          </div>
        </div>

        {isProcessing && (
          <div className="flex flex-col gap-2">
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
              Processing CSV files...
            </div>
            {processingStatus && (
              <div className="text-sm text-gray-600 ml-8">
                {processingStatus}
              </div>
            )}
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
              <div className="ml-3 flex-1 min-w-0">
                <h3 className="text-sm font-medium text-red-800">Import Error</h3>
                <div className="mt-2 text-sm text-red-700 whitespace-pre-wrap break-words">{error}</div>
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
              <div className="ml-3 flex-1 min-w-0">
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <div className="mt-2 text-sm text-green-700 whitespace-pre-wrap break-words">{success}</div>
              </div>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-500">
          <button
            onClick={() => setShowFormats(!showFormats)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-2"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showFormats ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>Supported formats & export guides (9)</span>
          </button>
          {showFormats && <ul className="space-y-2 ml-6">
            {/* Charles Schwab */}
            <li>
              <div className="flex justify-between items-center md:justify-start md:gap-4">
                <span>Charles Schwab</span>
                <button
                  onClick={() => setExpandedFormat(expandedFormat === 'schwab' ? null : 'schwab')}
                  className="text-blue-600 hover:text-blue-800 text-xs underline whitespace-nowrap"
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
                  <p className="text-blue-700 font-medium bg-blue-50 border border-blue-200 rounded p-2">
                    💡 If you have equity awards (RSUs, stock options), also download "Equity Awards" history separately and upload both files together.
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
              <div className="flex justify-between items-center md:justify-start md:gap-4">
                <span>Charles Schwab Equity Awards</span>
                <button
                  onClick={() => setExpandedFormat(expandedFormat === 'equity' ? null : 'equity')}
                  className="text-blue-600 hover:text-blue-800 text-xs underline whitespace-nowrap"
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
                  <p className="text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded p-2">
                    ⚠️ Equity Awards files only contain acquisitions (RSU vests). You must also upload "Transactions" history from Charles Schwab to include disposals (sales) for CGT calculations.
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

            {/* Interactive Brokers */}
            <li>
              <div className="flex justify-between items-center md:justify-start md:gap-4">
                <span>Interactive Brokers</span>
                <button
                  onClick={() => setExpandedFormat(expandedFormat === 'ibkr' ? null : 'ibkr')}
                  className="text-blue-600 hover:text-blue-800 text-xs underline whitespace-nowrap"
                >
                  {expandedFormat === 'ibkr' ? 'hide' : 'instructions & example'}
                </button>
              </div>
              {expandedFormat === 'ibkr' && (
                <div className="mt-2 ml-4 p-3 bg-gray-50 rounded text-xs space-y-2">
                  <p className="font-medium">How to download:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600">
                    <li>Log into Client Portal → Performance & Reports → Flex Queries</li>
                    <li>Click + to create new Activity Flex Query</li>
                    <li>Enable sections: Trades, Cash Transactions (optional: Corporate Actions)</li>
                    <li>Set format to CSV, date format to "yyyyMMdd", separator to semicolon</li>
                    <li>Run query and download CSV (max 1 year per export)</li>
                  </ol>
                  <p className="text-gray-600 italic">
                    Note: Interactive Brokers allows 1 year per export. For longer history, run the query for each year and upload multiple files.
                  </p>
                  <a
                    href="https://www.ibkrguides.com/clientportal/performanceandstatements/activityflex.htm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-blue-600 hover:text-blue-800 underline mr-4"
                  >
                    📖 Official instructions
                  </a>
                  <a
                    href="/examples/interactive-brokers-example.csv"
                    className="inline-block text-blue-600 hover:text-blue-800 underline"
                  >
                    📥 Download example file
                  </a>
                </div>
              )}
            </li>

            {/* Freetrade */}
            <li>
              <div className="flex justify-between items-center md:justify-start md:gap-4">
                <span>Freetrade</span>
                <button
                  onClick={() => setExpandedFormat(expandedFormat === 'freetrade' ? null : 'freetrade')}
                  className="text-blue-600 hover:text-blue-800 text-xs underline whitespace-nowrap"
                >
                  {expandedFormat === 'freetrade' ? 'hide' : 'instructions & example'}
                </button>
              </div>
              {expandedFormat === 'freetrade' && (
                <div className="mt-2 ml-4 p-3 bg-gray-50 rounded text-xs space-y-2">
                  <p className="font-medium">How to download:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600">
                    <li>Open Freetrade mobile app (iOS/Android)</li>
                    <li>Navigate to Activity tab (bottom of screen)</li>
                    <li>Optional: Use calendar icon to select custom date range</li>
                    <li>Tap Share icon (arrow pointing up) in top-right corner</li>
                    <li>Select "All Activity" and export file to device</li>
                  </ol>
                  <p className="text-gray-600 italic">
                    Note: Freetrade exports all activity at once. The CSV includes trades, dividends, interest, deposits, and withdrawals.
                  </p>
                  <a
                    href="https://help.freetrade.io/en/articles/6627908-how-do-i-download-a-csv-export-of-my-activity-feed"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-blue-600 hover:text-blue-800 underline mr-4"
                  >
                    📖 Official instructions
                  </a>
                  <a
                    href="/examples/freetrade-example.csv"
                    className="inline-block text-blue-600 hover:text-blue-800 underline"
                  >
                    📥 Download example file
                  </a>
                </div>
              )}
            </li>

            {/* EquatePlus */}
            <li>
              <div className="flex justify-between items-center md:justify-start md:gap-4">
                <span>EquatePlus</span>
                <button
                  onClick={() => setExpandedFormat(expandedFormat === 'equateplus' ? null : 'equateplus')}
                  className="text-blue-600 hover:text-blue-800 text-xs underline whitespace-nowrap"
                >
                  {expandedFormat === 'equateplus' ? 'hide' : 'instructions & example'}
                </button>
              </div>
              {expandedFormat === 'equateplus' && (
                <div className="mt-2 ml-4 p-3 bg-gray-50 rounded text-xs space-y-2">
                  <p className="font-medium">How to download:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600">
                    <li>Log into your EquatePlus account</li>
                    <li>Navigate to Activity or Transaction History</li>
                    <li>Select the date range for your transactions</li>
                    <li>Export (it will be XLSX, you need to convert it to CSV)</li>
                  </ol>
                  <p className="text-gray-600 italic">
                    Note: EquatePlus is commonly used for employee stock plans (RSUs, RSPs, ESPP). The CSV includes vesting events, sales, dividends, and withholding transactions.
                  </p>
                  <a
                    href="/examples/equateplus-example.csv"
                    className="inline-block text-blue-600 hover:text-blue-800 underline"
                  >
                    📥 Download example file
                  </a>
                </div>
              )}
            </li>

            {/* Revolut */}
            <li>
              <div className="flex justify-between items-center md:justify-start md:gap-4">
                <span>Revolut</span>
                <button
                  onClick={() => setExpandedFormat(expandedFormat === 'revolut' ? null : 'revolut')}
                  className="text-blue-600 hover:text-blue-800 text-xs underline whitespace-nowrap"
                >
                  {expandedFormat === 'revolut' ? 'hide' : 'instructions & example'}
                </button>
              </div>
              {expandedFormat === 'revolut' && (
                <div className="mt-2 ml-4 p-3 bg-gray-50 rounded text-xs space-y-2">
                  <a
                    href="https://help.revolut.com/help/profile-and-plan/managing-my-account/trading-statements-and-reports/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-blue-600 hover:text-blue-800 underline mr-4"
                  >
                    📖 Official instructions
                  </a>
                  <a
                    href="/examples/revolut-example.csv"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-blue-600 hover:text-blue-800 underline"
                  >
                    📥 Download example file
                  </a>
                </div>
              )}
            </li>

            {/* Coinbase */}
            <li>
              <div className="flex justify-between items-center md:justify-start md:gap-4">
                <span>Coinbase</span>
                <button
                  onClick={() => setExpandedFormat(expandedFormat === 'coinbase' ? null : 'coinbase')}
                  className="text-blue-600 hover:text-blue-800 text-xs underline whitespace-nowrap"
                >
                  {expandedFormat === 'coinbase' ? 'hide' : 'instructions & example'}
                </button>
              </div>
              {expandedFormat === 'coinbase' && (
                <div className="mt-2 ml-4 p-3 bg-gray-50 rounded text-xs space-y-2">
                  <p className="font-medium">How to download:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600">
                    <li>Log into coinbase.com</li>
                    <li>Go to Profile → Manage Account → Statements</li>
                    <li>Select date range "Custom" and set Start date as early as possible</li>
                    <li>Click "Generate"</li>
                  </ol>
                  <p className="text-gray-600 italic">
                    Note: Crypto transactions are treated like stock transactions for CGT purposes. The same HMRC matching rules apply.
                  </p>
                  <a
                    href="/examples/coinbase-example.csv"
                    className="inline-block text-blue-600 hover:text-blue-800 underline"
                  >
                    📥 Download example file
                  </a>
                </div>
              )}
            </li>

            {/* Generic CSV */}
            <li>
              <div className="flex justify-between items-center md:justify-start md:gap-4">
                <span>Generic CSV</span>
                <button
                  onClick={() => setExpandedFormat(expandedFormat === 'generic' ? null : 'generic')}
                  className="text-blue-600 hover:text-blue-800 text-xs underline whitespace-nowrap"
                >
                  {expandedFormat === 'generic' ? 'hide' : 'format & example'}
                </button>
              </div>
              {expandedFormat === 'generic' && (
                <div className="mt-2 ml-4 p-3 bg-gray-50 rounded text-xs space-y-2">
                  <p className="font-medium">What is Generic CSV?</p>
                  <p className="text-gray-600 mb-2">
                    A simplified format that matches the data model used internally by this tool.
                    Use this if your broker isn't supported yet, or to manually create test data.
                  </p>

                  <p className="font-medium">Always required:</p>
                  <p className="text-gray-600">date, type, symbol, currency</p>

                  <p className="font-medium mt-2">Required for BUY/SELL:</p>
                  <p className="text-gray-600">quantity, price</p>

                  <p className="font-medium mt-2">Required for DIVIDEND/FEE:</p>
                  <p className="text-gray-600">total</p>

                  <p className="font-medium mt-2">Required for STOCK_SPLIT:</p>
                  <p className="text-gray-600">split_ratio (e.g., "10:1", "2:1", "1:10" for reverse splits)</p>

                  <p className="font-medium mt-2">Optional:</p>
                  <p className="text-gray-600">name, total, fee, notes</p>

                  <p className="text-gray-600 mt-2 italic">
                    Transaction types: BUY, SELL, DIVIDEND, FEE, INTEREST, TRANSFER, TAX, STOCK_SPLIT
                  </p>

                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-xs text-blue-700">
                      <strong>Stock Splits:</strong> Use STOCK_SPLIT to record corporate actions like 10:1 splits.
                      The tool will automatically adjust your cost basis per HMRC TCGA92/S127 rules.
                    </p>
                  </div>

                  <a
                    href="/examples/generic-example.csv"
                    className="inline-block text-blue-600 hover:text-blue-800 underline mt-2"
                  >
                    📥 Download example file
                  </a>
                </div>
              )}
            </li>

            {/* Trading 212 */}
            <li>
              <div className="flex justify-between items-center md:justify-start md:gap-4">
                <span>Trading 212</span>
                <button
                  onClick={() => setExpandedFormat(expandedFormat === 'trading212' ? null : 'trading212')}
                  className="text-blue-600 hover:text-blue-800 text-xs underline whitespace-nowrap"
                >
                  {expandedFormat === 'trading212' ? 'hide' : 'instructions & example'}
                </button>
              </div>
              {expandedFormat === 'trading212' && (
                <div className="mt-2 ml-4 p-3 bg-gray-50 rounded text-xs space-y-2">
                  <p className="font-medium">How to download:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600">
                    <li>Log into Trading 212 app or website</li>
                    <li>Go to Menu → History</li>
                    <li>Tap the export button</li>
                    <li>Select timeframe (max 1 year) and data types</li>
                    <li>Download the CSV file when ready</li>
                  </ol>
                  <p className="text-gray-600 italic">
                    Note: Trading 212 limits downloads to 1 year. For longer history, download year by year and upload multiple files.
                  </p>
                  <a
                    href="/examples/trading212-example.csv"
                    className="inline-block text-blue-600 hover:text-blue-800 underline"
                  >
                    📥 Download example file
                  </a>
                </div>
              )}
            </li>
          </ul>}
        </div>
      </div>
    </div>
  )
}
