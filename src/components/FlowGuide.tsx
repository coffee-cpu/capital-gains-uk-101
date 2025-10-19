export function FlowGuide() {
  const steps = [
    'Export transactions from brokers',
    'Import files here',
    'Visualize transactions',
    'Review tax summary',
    'Export to PDF',
  ]

  return (
    <div className="px-4 py-2 hidden lg:block">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 whitespace-nowrap mr-2">How it works:</span>
        <div className="flex items-stretch gap-1">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative flex items-center px-6 py-2 flex-shrink-0 transition-all hover:bg-blue-200"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%, 16px 50%)',
                background: '#bfdbfe',
                marginLeft: index === 0 ? '0' : '-17px',
                zIndex: steps.length - index,
              }}
            >
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
