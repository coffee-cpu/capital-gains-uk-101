import { BrokerType, BrokerDetectionResult, RawCSVRow } from '../../types/broker'
import { BrokerDefinition } from '../../types/brokerDefinition'
import { normalizeInteractiveBrokersTransactions } from '../../lib/parsers/interactiveBrokers'

/**
 * Detect Interactive Brokers format
 * Multi-section CSV with distinctive structure:
 * - First column is section name (e.g., "Transaction History", "Statement", "Summary")
 * - Second column is row type ("Header" or "Data")
 * - Characteristic columns: "Transaction Type", "Gross Amount", "Net Amount", "Commission"
 */
function detectInteractiveBrokers(headers: string[], rows: RawCSVRow[]): BrokerDetectionResult {
  // IB CSV has a very distinctive multi-section format
  // First column contains section names like "Transaction History", "Statement", "Summary"
  // Second column is always "Header" or "Data"

  const firstColumnValues = rows.slice(0, 20).map(row => Object.values(row)[0]).filter(Boolean)
  const hasTransactionHistorySection = firstColumnValues.some(val => val === 'Transaction History')
  const hasStatementSection = firstColumnValues.some(val => val === 'Statement')
  const hasSummarySection = firstColumnValues.some(val => val === 'Summary')
  const hasSectionFormat = hasTransactionHistorySection || hasStatementSection || hasSummarySection

  // Check for second column being "Header" or "Data"
  const secondColumnValues = rows.slice(0, 20).map(row => Object.values(row)[1]).filter(Boolean)
  const hasRowTypeColumn = secondColumnValues.some(val => val === 'Header' || val === 'Data')

  // Check for characteristic IB Transaction History headers (these appear in the first row as column names)
  const ibHeaders = ['Transaction Type', 'Gross Amount', 'Net Amount', 'Commission', 'Symbol']
  const headerMatches = ibHeaders.filter(h => headers.includes(h))

  let confidence = 0

  // Strong indicators
  if (hasTransactionHistorySection && hasRowTypeColumn) {
    confidence = 0.95
  } else if (hasSectionFormat && hasRowTypeColumn) {
    confidence = 0.85
  } else if (hasTransactionHistorySection) {
    confidence = 0.7
  } else if (headerMatches.length >= 3) {
    confidence = 0.6
  } else if (headerMatches.length >= 2) {
    confidence = 0.4
  }

  return {
    broker: BrokerType.INTERACTIVE_BROKERS,
    confidence,
    headerMatches: headerMatches.length > 0 ? headerMatches : (hasSectionFormat ? ['Transaction History section format'] : []),
  }
}

export const interactiveBrokersDefinition: BrokerDefinition = {
  type: BrokerType.INTERACTIVE_BROKERS,
  displayName: 'Interactive Brokers',
  shortId: 'ibkr',
  detection: {
    requiredHeaders: [], // Uses custom detector instead
    priority: 5, // Check early since it has unique multi-section format
    customDetector: detectInteractiveBrokers,
  },
  parser: (rows, fileId, _source) => normalizeInteractiveBrokersTransactions(rows, fileId),
  instructions: {
    steps: [
      'Log into Client Portal → Performance & Reports → Transaction History',
      'Select custom time period',
      'Download CSV',
    ],
  },
  exampleFile: '/examples/interactive-brokers-example.csv',
  enabled: true,
}
