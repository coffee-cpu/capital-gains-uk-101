export function About() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Disclaimer */}
          <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
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
                <h2 className="text-xl font-semibold text-yellow-900 mb-2">Important Disclaimer</h2>
                <div className="text-sm text-yellow-800 space-y-2">
                  <p>
                    <strong>This is not financial or tax advice.</strong> Capital Gains Tax UK 101 is an educational and visualization tool only.
                  </p>
                  <p>
                    All calculations are approximate and based on publicly available HMRC guidance. No guarantee is made as to the accuracy, completeness, or applicability of the results.
                  </p>
                  <p>
                    <strong>Always verify your figures</strong> and consult a qualified tax professional or accountant before submitting any official tax returns to HMRC.
                  </p>
                  <p className="font-semibold text-yellow-900">
                    Use this tool at your own risk. The developers accept no liability for any errors, omissions, or losses arising from its use.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">How the Calculator Works</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                Capital Gains Tax UK 101 is a <strong>privacy-focused, browser-only</strong> tool that helps UK taxpayers calculate capital gains tax on share transactions. All data processing happens locally in your browser — no data is ever uploaded to any server.
              </p>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Process Overview:</h3>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li><strong>Import transactions</strong> from your broker (Schwab, Schwab Equity Awards, or Generic format)</li>
                  <li><strong>Automatic format detection</strong> identifies your broker and normalizes the data</li>
                  <li><strong>FX rate enrichment</strong> converts foreign currency values to GBP using official HMRC monthly exchange rates</li>
                  <li><strong>CGT calculation</strong> applies HMRC matching rules to calculate gains/losses</li>
                </ol>
              </div>
            </div>
          </section>

          {/* HMRC Matching Rules */}
          <section className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">HMRC Matching Rules</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                When calculating capital gains tax on shares, HMRC requires specific matching rules to be applied in a defined order. These rules determine which shares you're selling and at what cost.
              </p>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">1. Same-Day Rule</h3>
                  <p>
                    Shares sold are matched first with shares bought on the <strong>same day</strong>. This prevents artificial loss creation by selling and buying back on the same day.
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Reference:{' '}
                    <a
                      href="https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      HMRC CG51560
                    </a>
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">2. 30-Day "Bed and Breakfast" Rule</h3>
                  <p>
                    After same-day matching, shares sold are matched with shares bought within the <strong>following 30 days</strong>. This prevents tax loss harvesting by selling shares and immediately repurchasing them.
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Reference:{' '}
                    <a
                      href="https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      HMRC CG51560
                    </a>
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">3. Section 104 Pool</h3>
                  <p>
                    Finally, remaining shares are matched against the <strong>Section 104 pool</strong> — a single pool of shares acquired at different times and prices. The pool maintains an average cost basis.
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Reference:{' '}
                    <a
                      href="https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51620"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      HMRC CG51620
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* FX Rates */}
          <section className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Exchange Rates</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                Foreign currency transactions are converted to GBP using{' '}
                <a
                  href="https://www.trade-tariff.service.gov.uk/exchange_rates"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-semibold"
                >
                  official HMRC exchange rates
                </a>.
              </p>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Monthly Rates</h3>
                <p>
                  HMRC publishes one exchange rate per currency per month. All transactions in a given month use the same official rate, as required for UK tax reporting.
                </p>
                <p className="mt-2">
                  Rates are published on the <strong>penultimate Thursday</strong> of each month, represent values as of midday the day before publication, and apply to the <em>following</em> calendar month.
                </p>
              </div>
            </div>
          </section>

          {/* Privacy */}
          <section className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Privacy Guarantee</h2>
            <div className="space-y-4 text-gray-700">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 1l-7 4v5c0 4.418 3.134 8.545 7 10 3.866-1.455 7-5.582 7-10V5l-7-4zm0 2.236l5 2.857v4.143c0 3.416-2.365 6.613-5 7.928-2.635-1.315-5-4.512-5-7.928V6.093l5-2.857z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-semibold text-green-900">100% Client-Side Processing</h3>
                    <p className="mt-1 text-sm text-green-800">
                      All calculations happen in your browser. Your transaction data never leaves your device.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">What This Means:</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>No servers:</strong> There is no backend server. The app runs entirely in your browser.</li>
                  <li><strong>No uploads:</strong> Your CSV files are processed locally and never uploaded anywhere.</li>
                  <li><strong>No tracking:</strong> No analytics, cookies, or tracking scripts are used.</li>
                  <li><strong>Local storage only:</strong> Data is stored in your browser's IndexedDB for your convenience. You can clear it anytime.</li>
                  <li><strong>Open source:</strong> The code is available on{' '}
                    <a
                      href="https://github.com/coffee-cpu/capital-gains-uk-101"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      GitHub
                    </a>
                    {' '}for transparency.
                  </li>
                </ul>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">External API Calls:</h3>
                <p>
                  The only external network requests are to fetch{' '}
                  <a
                    href="https://www.trade-tariff.service.gov.uk/exchange_rates"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    HMRC exchange rates
                  </a>
                  {' '}for currency conversion. These requests contain only the date and currency code — no personal or transaction data.
                </p>
              </div>
            </div>
          </section>

          {/* Back to Calculator */}
          <div className="text-center pt-6">
            <a
              href="/"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              ← Back to Calculator
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
