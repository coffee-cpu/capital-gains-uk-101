import { ClearDataButton } from './ClearDataButton'

interface SidebarProps {
  currentPage: 'calculator' | 'about'
}

export function Sidebar({ currentPage }: SidebarProps) {
  const isCalculatorActive = currentPage === 'calculator'
  const isAboutActive = currentPage === 'about'

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0 flex flex-col">
      {/* Header */}
      <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <img
            src="/favicon/favicon.svg"
            alt="Logo"
            className="w-10 h-10 flex-shrink-0"
          />

          {/* Title */}
          <div className="flex flex-col gap-1">
            <div className="text-base font-bold leading-tight">
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

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        <a
          href="#"
          className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            isCalculatorActive
              ? 'text-gray-900 bg-gray-100'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Calculator
        </a>

        <a
          href="#about"
          className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            isAboutActive
              ? 'text-gray-900 bg-gray-100'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          About
        </a>

        <a
          href="https://github.com/coffee-cpu/capital-gains-uk-101"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          GitHub
        </a>
      </nav>

      {/* Clear Data Button */}
      <div className="p-4">
        <ClearDataButton variant="compact" />
      </div>

      {/* Footer info */}
      <div className="mt-auto p-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Privacy-focused • Client-side only
        </p>
        <p className="text-xs text-gray-500 mt-1">
          No data leaves your browser
        </p>
      </div>
    </aside>
  )
}
