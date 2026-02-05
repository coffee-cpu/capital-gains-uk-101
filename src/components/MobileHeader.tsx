/**
 * Mobile header component - shown on small screens
 */
export function MobileHeader({ onMenuToggle }: { onMenuToggle: () => void }) {
  return (
    <header className="lg:hidden sticky top-0 z-10 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200 px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2 flex-1">
          <img
            src="/favicon/favicon.svg"
            alt="Logo"
            className="w-8 h-8 flex-shrink-0"
          />
          <div className="flex flex-col">
            <div className="text-sm font-bold leading-tight">
              <span className="text-blue-600">C</span>
              <span className="text-gray-900">apital </span>
              <span className="text-blue-600">G</span>
              <span className="text-gray-900">ains </span>
              <span className="text-blue-600">T</span>
              <span className="text-gray-900">ax</span>
            </div>
            <div className="text-xs font-semibold text-gray-600">
              Visualiser
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
