import { useTransactionStore, selectTransactions } from '../stores/transactionStore'

// Built from the sample portfolio (made-up data) by `npm run build:example-report`
const EXAMPLE_PDF = '/examples/example-report-2025-26.pdf'
const EXAMPLE_IMAGE = '/examples/example-report-2025-26.jpg'

/**
 * Shows what the PDF report looks like before anything is imported: the top
 * of page 1, linking to the full example. Hidden once there's data.
 */
export function ExampleReport() {
  const hasData = useTransactionStore((state) => selectTransactions(state).length > 0)
  // Also hidden while results load, so returning users don't see it flash
  const isLoading = useTransactionStore((state) => state.isLoading)
  if (hasData || isLoading) return null

  return (
    <section aria-labelledby="example-report-title" data-testid="example-report" className="bg-white shadow rounded-lg p-6">
      {/* One column on phones, title first; on wider screens the preview sits
          left of the title and text */}
      <div className="grid gap-x-5 sm:grid-cols-[16rem_1fr] sm:grid-rows-[auto_1fr]">
        <h2 id="example-report-title" className="mb-3 sm:mb-0 sm:col-start-2 sm:row-start-1 text-lg font-semibold text-gray-900">What you get</h2>
        <a
          href={EXAMPLE_PDF}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open the example PDF report"
          className="group relative block w-full sm:col-start-1 sm:row-start-1 sm:row-span-2 overflow-hidden rounded-md border border-gray-200 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {/* The top of page 1, fading out: enough to see the summary and the SA108 boxes */}
          <img
            src={EXAMPLE_IMAGE}
            alt="Page 1 of an example report: tax year summary and SA108 capital gains boxes"
            width={707}
            height={1000}
            loading="lazy"
            className="block w-full h-56 sm:h-72 object-cover object-top transition-transform group-hover:scale-[1.02]"
          />
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
        </a>
        <div className="mt-4 sm:mt-1 sm:col-start-2 sm:row-start-2 text-sm text-gray-600">
          <p>
            A PDF report for each tax year: the summary, the figures for each SA108 box, and how every disposal was matched under HMRC rules.
          </p>
          <a
            href={EXAMPLE_PDF}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block font-medium text-brand-700 underline hover:text-brand-800"
          >
            Open the example report (PDF)
          </a>
          <p className="mt-1 text-xs text-gray-500">Made from the sample portfolio, with made-up figures.</p>
        </div>
      </div>
    </section>
  )
}
