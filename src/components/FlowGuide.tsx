import { ArrowRight } from 'lucide-react'

export function FlowGuide() {
  const steps = [
    { title: 'Export transactions from brokers', icon: '📊' },
    { title: 'Import files here', icon: '📥' },
    { title: 'Visualize transactions', icon: '📈' },
    { title: 'Review tax summary', icon: '📋' },
    { title: 'Export to PDF', icon: '📄' },
  ]

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 overflow-x-auto">
        <span className="text-sm font-medium text-gray-700 whitespace-nowrap mr-2">How it works:</span>
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-sm text-gray-700">
              <span>{step.icon}</span>
              <span className="whitespace-nowrap">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <ArrowRight className="text-gray-400 w-4 h-4 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
