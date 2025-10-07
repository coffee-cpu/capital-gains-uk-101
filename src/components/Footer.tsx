export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-yellow-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-semibold text-yellow-800">Disclaimer</h3>
              <div className="mt-2 text-sm text-yellow-700 space-y-2">
                <p>
                  CGT Visualizer is an educational and visualization tool, not financial or tax
                  advice. All calculations are approximate and based on publicly available HMRC
                  guidance.
                </p>
                <p>
                  No guarantee is made as to the accuracy, completeness, or applicability of the
                  results. Always verify your figures and consult a qualified tax professional
                  before submitting any official tax returns.
                </p>
                <p className="font-medium">
                  All processing is performed locally in your browser — your data is never uploaded
                  or shared.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Built with{' '}
            <a
              href="https://react.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              React
            </a>
            ,{' '}
            <a
              href="https://www.typescriptlang.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              TypeScript
            </a>
            , and{' '}
            <a
              href="https://tailwindcss.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Tailwind CSS
            </a>
          </p>
          <p className="mt-2">
            Based on{' '}
            <a
              href="https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51500p"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              HMRC Capital Gains Manual
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
