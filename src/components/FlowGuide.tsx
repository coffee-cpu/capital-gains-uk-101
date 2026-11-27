import { useEffect, useState } from 'react'
import { useTransactionStore, selectTransactions } from '../stores/transactionStore'

type StopState = 'done' | 'next' | 'locked'

interface Stop {
  name: string
  description: string
  /** Fine print for phones, where the full description doesn't fit */
  short: string
  /** Section the stop jumps to (an element id) */
  target: string
  state: StopState
}

/** Jump to a section, centred, without changing the URL */
function jumpTo(event: React.MouseEvent, id: string) {
  event.preventDefault()
  const el = document.getElementById(id)
  if (!el) return
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: id === 'export-pdf' ? 'center' : 'start' })
}

const DOT_STYLES: Record<StopState, string> = {
  done: 'bg-brand-600 border-brand-600',
  next: 'bg-white border-brand-600',
  locked: 'bg-white border-gray-300',
}

/**
 * Sections the user has looked at this visit: scrolled into the top part of
 * the screen, or jumped to from the line. Watched only while they exist:
 * the sections swap in a spinner while results recalculate, so the caller
 * stops watching then and the new elements are observed afterwards.
 */
function useSeenSections(ids: string[], watch: boolean) {
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set())
  const key = ids.join(' ')

  useEffect(() => {
    if (!watch || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).map(e => e.target.id)
        if (visible.length > 0) setSeen(prev => new Set([...prev, ...visible]))
      },
      // Counts once the section reaches the top 60% of the screen, not just its bottom edge
      { rootMargin: '0px 0px -40% 0px' }
    )
    for (const id of key.split(' ')) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [key, watch])

  const markSeen = (id: string) => setSeen(prev => new Set([...prev, id]))
  return { seen, markSeen }
}

/**
 * "How it works" as a line with a stop per step. Stops tick off as the user
 * gets through them and jump to their section once it exists.
 */
export function FlowGuide() {
  const hasData = useTransactionStore((state) => selectTransactions(state).length > 0)
  // A tax year summary needs at least one tax year with activity (not only dividends, say)
  const hasSummary = useTransactionStore((state) => (state.cgtResults?.taxYearSummaries.length ?? 0) > 0)
  const hasDisposals = useTransactionStore((state) => (state.cgtResults?.metadata?.totalSells ?? 0) > 0)
  const hasExportedPDF = useTransactionStore((state) => state.hasExportedPDF)
  const isLoading = useTransactionStore((state) => state.isLoading)
  const { seen, markSeen } = useSeenSections(['transactions', 'tax-year-summary'], hasData && !isLoading)

  // Locked until its section exists, then next until done
  const stateOf = (ready: boolean, done: boolean): StopState => (!ready ? 'locked' : done ? 'done' : 'next')
  const stops: Stop[] = [
    { name: 'Export', description: 'History from each broker', short: 'from broker', target: 'import', state: hasData ? 'done' : 'next' },
    { name: 'Import', description: 'Drop the CSV files', short: 'CSV files', target: 'import', state: hasData ? 'done' : 'next' },
    { name: 'Check', description: 'HMRC matching rules', short: 'HMRC rules', target: 'transactions', state: stateOf(hasData, seen.has('transactions')) },
    { name: 'Tax year', description: 'Gains and SA108 figures', short: 'figures', target: 'tax-year-summary', state: stateOf(hasSummary, seen.has('tax-year-summary')) },
    { name: 'PDF', description: 'For Self Assessment', short: 'report', target: 'export-pdf', state: stateOf(hasDisposals, hasExportedPDF) },
  ]

  // The track runs between the first and last stop's centres; the coloured
  // part runs through the unbroken run of completed stops from the start
  const inset = `${50 / stops.length}%`
  const firstNotDone = stops.findIndex(s => s.state !== 'done')
  const doneRun = firstNotDone === -1 ? stops.length : firstNotDone
  const progress = doneRun > 1 ? (doneRun - 1) / (stops.length - 1) : 0

  return (
    <nav aria-label="How it works" data-testid="flow-guide" className="px-1 sm:px-4">
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute top-[7px] h-[3px] rounded-full bg-gray-300 origin-left animate-flow-line motion-reduce:animate-none"
          style={{ left: inset, right: inset }}
        />
        {/* Always rendered, so progress grows it from where it was instead of replaying the entrance */}
        <div
          aria-hidden="true"
          className="absolute top-[7px] h-[3px] rounded-full bg-brand-600 origin-left animate-flow-line motion-reduce:animate-none transition-[width] duration-500"
          style={{ left: inset, width: `calc((100% - 2 * ${inset}) * ${progress})` }}
        />

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
                  <span aria-hidden="true" className={`mt-0.5 sm:hidden text-[10px] leading-tight ${stop.state === 'locked' ? 'text-gray-300' : 'text-gray-400'}`}>
                    {stop.short}
                  </span>
                </span>
              </>
            )

            // Always an <a>, so unlocking a stop keeps its elements and their entrance
            // animation doesn't replay. Without an href a locked stop isn't a link or focusable
            const locked = stop.state === 'locked'
            return (
              <li key={stop.name} className="flex-1 min-w-0 text-center">
                <a
                  href={locked ? undefined : `#${stop.target}`}
                  onClick={locked ? undefined : (e) => { markSeen(stop.target); jumpTo(e, stop.target) }}
                  aria-disabled={locked || undefined}
                  aria-label={locked ? undefined : `${stop.name}: ${stop.description}${stop.state === 'done' ? ' (done)' : ''}`}
                  className="group flex flex-col items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  {content}
                </a>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
