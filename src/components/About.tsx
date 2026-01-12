import { BuyMeACoffee } from './BuyMeACoffee'
import { CodingStats } from './CodingStats'

export function About() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 lg:py-12 px-4 sm:px-6 lg:px-8">
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
                    <strong>This is not financial or tax advice.</strong> Capital Gains Tax Visualiser is an educational and visualisation tool only.
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
                Capital Gains Tax Visualiser is a <strong>privacy-focused, browser-only</strong> tool that helps UK taxpayers calculate capital gains tax on share transactions. All data processing happens locally in your browser — no data is ever uploaded to any server.
              </p>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Process Overview:</h3>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li><strong>Import transactions</strong> from your broker — multiple formats are auto-detected</li>
                  <li><strong>Automatic format detection</strong> identifies your broker and normalizes the data</li>
                  <li><strong>Stock split adjustment</strong> adjusts quantities and prices for any stock splits to ensure all shares are in comparable units</li>
                  <li><strong>FX rate enrichment</strong> converts foreign currency values to GBP using official exchange rates</li>
                  <li><strong>CGT calculation</strong> applies HMRC matching rules to calculate gains/losses</li>
                </ol>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-1">UK Tax Year</h3>
                <p className="text-sm text-gray-700">
                  UK tax years run from <strong>6 April to 5 April</strong>. For example, tax year 2023/24 covers 6 April 2023 to 5 April 2024.
                </p>
              </div>
            </div>
          </section>

          {/* HMRC Matching Rules */}
          <section className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">HMRC Matching Rules</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                When calculating capital gains tax on shares, HMRC requires specific matching rules to be applied in a defined order. These rules determine which shares you're selling and at what cost. This calculator is based on the{' '}
                <a
                  href="https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51500p"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-semibold"
                >
                  HMRC Capital Gains Manual
                </a>.
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

          {/* Stock Splits */}
          <section className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Stock Splits</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                Stock splits are corporate actions where a company increases the number of shares outstanding by dividing existing shares. For example, in a 4:1 split, each share is divided into 4 shares, and the price per share is divided by 4.
              </p>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">HMRC Treatment</h3>
                <p>
                  Under HMRC rules, stock splits are treated as <strong>share reorganisations</strong> (TCGA92/S127). Importantly:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li><strong>No disposal occurs:</strong> A stock split is not a taxable event — you are not selling or disposing of your shares</li>
                  <li><strong>Cost basis is preserved:</strong> The total cost of your holding remains the same, just spread across more shares</li>
                  <li><strong>No capital gains tax:</strong> No CGT is due at the time of the split</li>
                </ul>
                <p className="text-sm text-gray-600 mt-2">
                  Reference:{' '}
                  <a
                    href="https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51700"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    HMRC CG51700
                  </a>
                  {' '}(Share reorganisations and company reconstructions)
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">How This Tool Handles Splits</h3>
                <p>
                  To ensure accurate CGT calculations, the calculator automatically adjusts all transactions for affected stocks:
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-2">
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong className="text-blue-900">Adjustment Process:</strong>
                      <ul className="list-disc list-inside ml-4 mt-1 text-blue-800">
                        <li>All transactions <strong>before</strong> the split date are adjusted to post-split quantities</li>
                        <li>Share quantities are multiplied by the split ratio (e.g., ×4 for a 4:1 split)</li>
                        <li>Share prices are divided by the split ratio (e.g., ÷4 for a 4:1 split)</li>
                        <li>Original values are preserved and shown alongside adjusted values for transparency</li>
                      </ul>
                    </div>
                    <div className="pt-2">
                      <strong className="text-blue-900">Example (4:1 split on 2020-08-31):</strong>
                      <div className="ml-4 mt-1 font-mono text-xs">
                        <div>Original: Bought 10 shares @ $360/share = $3,600 total</div>
                        <div>Adjusted: Bought 40 shares @ $90/share = $3,600 total</div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="mt-2">
                  This adjustment ensures that when calculating capital gains, all share quantities are in comparable units, making the matching rules work correctly across split events.
                </p>
              </div>
            </div>
          </section>

          {/* FX Rates */}
          <section className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Exchange Rates</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                Foreign currency transactions are converted to GBP. HMRC does not prescribe a specific exchange rate source, but requires a{' '}
                <strong>"reasonable and consistent method"</strong> be used.
              </p>
              <p className="text-sm text-gray-600">
                Reference:{' '}
                <a
                  href="https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg78310"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  HMRC CG78310
                </a>
              </p>

              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Available Rate Sources</h3>
                <p className="text-sm text-gray-600 mb-4">
                  You can choose which exchange rate source to use in the calculator settings. All sources are acceptable for UK tax purposes.
                </p>

                <div className="space-y-4">
                  {/* HMRC Monthly */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">HMRC Monthly Rates</h4>
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">Default</span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-700">
                      Official HMRC rates published monthly. One fixed rate per currency per month — all transactions in a given month use the same rate.
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Source:{' '}
                      <a
                        href="https://www.trade-tariff.service.gov.uk/exchange_rates/monthly"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        HMRC Trade Tariff Service
                      </a>
                    </p>
                  </div>

                  {/* HMRC Yearly Average */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">HMRC Yearly Average</h4>
                    <p className="mt-2 text-sm text-gray-700">
                      HMRC annual average rates. Simpler calculation using one rate for the entire year — less precise during volatile currency periods.
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Source:{' '}
                      <a
                        href="https://www.trade-tariff.service.gov.uk/exchange_rates/average"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        HMRC Trade Tariff Service
                      </a>
                    </p>
                  </div>

                  {/* Daily Spot Rates */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">Daily Spot Rates (ECB)</h4>
                    <p className="mt-2 text-sm text-gray-700">
                      European Central Bank daily reference rates. Most accurate for transaction-date conversions — uses the exact rate for each transaction date.
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Source:{' '}
                      <a
                        href="https://frankfurter.dev/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        European Central Bank (via Frankfurter API)
                      </a>
                    </p>
                  </div>
                </div>
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

          {/* Project Stats */}
          <CodingStats />

          {/* Support the Project */}
          <section>
            <BuyMeACoffee />
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
