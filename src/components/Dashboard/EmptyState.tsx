import { BarChart3 } from 'lucide-react'

interface EmptyStateProps {
  message?: string
}

export function EmptyState({ message = 'Import transactions to see charts' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <BarChart3 className="w-12 h-12 mb-3" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
