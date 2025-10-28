import { GenericTransaction } from '../types/transaction'

/**
 * Export transactions to Generic CSV format
 * @param transactions Array of transactions to export
 * @param filename Optional filename (defaults to transactions-export.csv)
 */
export function exportTransactionsToCSV(
  transactions: GenericTransaction[],
  filename: string = 'transactions-export.csv'
): void {
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
    'notes'
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
      tx.notes || ''
    ]
  })

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSVField).join(','))
  ].join('\n')

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
