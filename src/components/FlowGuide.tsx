import { useTransactionStore, selectTransactions } from '../stores/transactionStore'

type StopState = 'done' | 'next' | 'locked'

interface Stop {
  name: string
  description: string
  /** Section the stop jumps to (an element id) */
  target: string
  state: StopState
}

/** Jump to a section, centred, without changing the URL */
function jumpTo(event: React.MouseEvent, id: string) {
  const el = document.getElementById(id)
  if (!el) return
  event.preventDefault()
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: id === 'export-pdf' ? 'center' : 'start' })
}

const DOT_STYLES: Record<StopState, string> = {
  done: 'bg-brand-600 border-brand-600',
  next: 'bg-white border-brand-600',
  locked: 'bg-white border-gray-300',
}

/**
 * "How it works" as a line with a stop per step. Stops tick off as the user
 * gets through them and jump to their section once it exists.
 */
export function FlowGuide() {
  const hasData = useTransactionStore((state) => selectTransactions(state).length > 0)
  const hasDisposals = useTransactionStore((state) => (state.cgtResults?.metadata?.totalSells ?? 0) > 0)

  const after = (ready: boolean): StopState => (ready ? 'next' : 'locked')
  const stops: Stop[] = [
    { name: 'Export', description: 'History from each broker', target: 'import', state: hasData ? 'done' : 'next' },
    { name: 'Import', description: 'Drop the CSV files', target: 'import', state: hasData ? 'done' : 'next' },
    { name: 'Check', description: 'HMRC matching rules', target: 'transactions', state: after(hasData) },
    { name: 'Tax year', description: 'Gains and SA108 figures', target: 'tax-year-summary', state: after(hasData) },
    { name: 'PDF', description: 'For Self Assessment', target: 'export-pdf', state: after(hasDisposals) },
  ]

  // The track runs between the first and last stop's centres; the coloured
  // part runs up to the last completed stop
  const inset = `${50 / stops.length}%`
  const doneCount = stops.filter(s => s.state === 'done').length
  const progress = doneCount > 1 ? (doneCount - 1) / (stops.length - 1) : 0

  return (
    <nav aria-label="How it works" data-testid="flow-guide" className="px-1 sm:px-4">
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute top-[7px] h-[3px] rounded-full bg-gray-300 origin-left animate-flow-line motion-reduce:animate-none"
          style={{ left: inset, right: inset }}
        />
        {progress > 0 && (
          <div
            aria-hidden="true"
            className="absolute top-[7px] h-[3px] rounded-full bg-brand-600 origin-left animate-flow-line motion-reduce:animate-none"
            style={{ left: inset, width: `calc((100% - 2 * ${inset}) * ${progress})` }}
          />
        )}

        <ol className="relative flex items-start">
          {stops.map((stop, index) => {
            const delay = { animationDelay: `${300 + index * 150}ms` }
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className={`relative z-10 flex h-[17px] w-[17px] items-center justify-center rounded-full border-[3px] animate-flow-dot motion-reduce:animate-none ${DOT_STYLES[stop.state]}`}
                  style={delay}
                >
                  {stop.state === 'done' && (
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
                <span className="mt-2 flex flex-col items-center animate-flow-label motion-reduce:animate-none" style={delay}>
                  <span className={`text-[11px] sm:text-xs font-semibold uppercase tracking-wider ${stop.state === 'locked' ? 'text-gray-400' : 'text-gray-900'}`}>
                    {stop.name}
                  </span>
                  <span className={`mt-0.5 hidden sm:block text-xs ${stop.state === 'locked' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {stop.description}
                  </span>
                </span>
              </>
            )

            return (
              <li key={stop.name} className="flex-1 min-w-0 text-center">
                {stop.state === 'locked' ? (
                  <div className="flex flex-col items-center" aria-disabled="true">{content}</div>
                ) : (
                  <a
                    href={`#${stop.target}`}
                    onClick={(e) => jumpTo(e, stop.target)}
                    aria-label={`${stop.name}: ${stop.description}${stop.state === 'done' ? ' (done)' : ''}`}
                    className="group flex flex-col items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {content}
                  </a>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
