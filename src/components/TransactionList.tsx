import { useTransactionStore } from '../stores/transactionStore'
import { ClearDataButton } from './ClearDataButton'

export function TransactionList() {
  const transactions = useTransactionStore((state) => state.transactions)

  // Sort transactions by date (oldest first)
  const sortedTransactions = [...transactions].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  // Check for incomplete Stock Plan Activity transactions
  const incompleteTransactions = transactions.filter(tx => tx.incomplete)
  const incompleteSymbols = [...new Set(incompleteTransactions.map(tx => tx.symbol))].filter(Boolean)

  if (transactions.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-500 text-center">No transactions imported yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Transactions</h2>
            <p className="text-sm text-gray-500 mt-1">{transactions.length} total</p>
          </div>
          <ClearDataButton />
        </div>
      </div>

      {/* Warning for incomplete Stock Plan Activity */}
      {incompleteSymbols.length > 0 && (
        <div className="px-6 py-4 bg-yellow-50 border-b border-yellow-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Incomplete Stock Plan Activity Detected</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  {incompleteTransactions.length} Stock Plan Activity transaction{incompleteTransactions.length !== 1 ? 's' : ''} for {incompleteSymbols.join(', ')} {incompleteSymbols.length !== 1 ? 'are' : 'is'} missing price data.
                </p>
                <p className="mt-1">
                  <strong>Action required:</strong> Please upload your Charles Schwab Equity Awards transaction history to get complete pricing information.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Symbol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedTransactions.map((tx) => {
              // Determine if this transaction is relevant to display prominently
              // BUY/SELL are relevant to CGT, DIVIDEND is important for tax reporting
              const isRelevant = tx.type === 'BUY' || tx.type === 'SELL' || tx.type === 'DIVIDEND'
              const isIncomplete = tx.incomplete
              const rowClassName = isIncomplete ? 'bg-yellow-50' : (isRelevant ? '' : 'opacity-50')

              return (
                <tr key={tx.id} className={rowClassName}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tx.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {tx.symbol || '—'}
                      {isIncomplete && (
                        <svg className="h-4 w-4 text-yellow-500" viewBox="0 0 20 20" fill="currentColor" title="Missing price data">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      tx.type === 'BUY' ? 'bg-green-100 text-green-800' :
                      tx.type === 'SELL' ? 'bg-red-100 text-red-800' :
                      tx.type === 'DIVIDEND' ? 'bg-blue-100 text-blue-800' :
                      tx.type === 'INTEREST' ? 'bg-purple-100 text-purple-800' :
                      tx.type === 'TAX' ? 'bg-yellow-100 text-yellow-800' :
                      tx.type === 'TRANSFER' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tx.quantity !== null ? tx.quantity.toFixed(2) : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tx.price !== null ? `$${tx.price.toFixed(2)}` : (isIncomplete ? <span className="text-yellow-600 font-medium">Missing</span> : '—')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tx.total !== null ? `$${tx.total.toFixed(2)}` : (isIncomplete ? <span className="text-yellow-600 font-medium">Missing</span> : '—')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {tx.source}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
