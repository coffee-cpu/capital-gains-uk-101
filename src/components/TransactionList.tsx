import { useTransactionStore } from '../stores/transactionStore'
import { ClearDataButton } from './ClearDataButton'

export function TransactionList() {
  const transactions = useTransactionStore((state) => state.transactions)

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
            {transactions.map((tx) => {
              // Determine if this transaction is relevant to display prominently
              // BUY/SELL are relevant to CGT, DIVIDEND is important for tax reporting
              const isRelevant = tx.type === 'BUY' || tx.type === 'SELL' || tx.type === 'DIVIDEND'
              const rowClassName = isRelevant ? '' : 'opacity-50'

              return (
                <tr key={tx.id} className={rowClassName}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tx.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {tx.symbol || '—'}
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
                    {tx.price !== null ? `$${tx.price.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tx.total !== null ? `$${tx.total.toFixed(2)}` : '—'}
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
