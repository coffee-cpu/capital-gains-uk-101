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
  if (hasData) return null

  return (
    <section aria-labelledby="example-report-title" data-testid="example-report" className="bg-white shadow rounded-lg p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <a
          href={EXAMPLE_PDF}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open the example PDF report"
          className="group relative block w-full sm:w-64 shrink-0 overflow-hidden rounded-md border border-gray-200 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
        <div className="text-sm text-gray-600">
          <h2 id="example-report-title" className="text-lg font-semibold text-gray-900">What you get</h2>
          <p className="mt-1">
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
