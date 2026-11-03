import { GenericTransaction } from '../types/transaction'
import { isCryptoSource } from '../lib/cgt/sa108'

/**
 * Export transactions to Generic CSV format and trigger a browser download
 * @param transactions Array of transactions to export
 * @param filename Optional filename (defaults to transactions-export.csv)
 */
export function exportTransactionsToCSV(
  transactions: GenericTransaction[],
  filename: string = 'transactions-export.csv'
): void {
  const csvContent = transactionsToGenericCSV(transactions)

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Serialise transactions as Generic CSV text (oldest first)
 */
export function transactionsToGenericCSV(transactions: GenericTransaction[]): string {
  // Define CSV headers matching Generic CSV format
  const headers = [
    'date',
    'type',
    'symbol',
    'currency',
    'name',
    'quantity',
    'price',
    'total',
    'fee',
    'notes',
    'split_ratio',
    'asset_class'
  ]

  // Sort transactions by date (oldest first)
  const sortedTransactions = [...transactions].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  // Convert transactions to CSV rows
  const rows = sortedTransactions.map(tx => {
    return [
      tx.date,
      tx.type,
      tx.symbol,
      tx.currency,
      tx.name || '',
      tx.quantity !== null ? tx.quantity.toString() : '',
      tx.price !== null ? tx.price.toString() : '',
      tx.total !== null ? tx.total.toString() : '',
      tx.fee !== null ? tx.fee.toString() : '',
      tx.notes || '',
      tx.ratio || '',
      // Write only what the source said: the crypto exchange is lost once
      // the source becomes "Generic CSV". A cryptocurrency price is still in
      // the file, so that rule still applies on re-import; writing it out
      // would freeze a guess (e.g. an unlisted fiat code) as a stated value
      tx.asset_class ?? (isCryptoSource(tx.source) ? 'crypto' : '')
    ]
  })

  // Combine headers and rows
  return [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSVField).join(','))
  ].join('\n')
}

/**
 * Escape CSV field value
 * - Wrap in quotes if contains comma, newline, or quote
 * - Double any quotes inside the value
 */
function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
