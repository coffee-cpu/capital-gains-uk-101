import { AlertTriangle, CheckCircle2, ChevronDown, FileText } from 'lucide-react'
import { useTransactionStore } from '../stores/transactionStore'
import { useHelpPanelStore } from '../stores/helpPanelStore'
import { useState } from 'react'
import { DisposalRecords } from './DisposalRecords'
import { Tooltip } from './Tooltip'
import { DividendDetailsPanel, InterestDetailsPanel } from './IncomeDetailsPanels'
import { IssuePointer } from './IssuePointer'
import { ExportPDFButton } from './ExportPDFButton'
import { BuyMeACoffee } from './BuyMeACoffee'
import { TaxYearFeaturesRenderer } from './taxYearFeatures'
import { formatGbp, formatGbpWhole } from '../utils/currency'
import { sa108ReportingNeed } from '../lib/cgt/reporting'
import { sa108Rows } from '../lib/cgt/sa108'
import type { TaxYearSummary as TaxYearSummaryData } from '../types/cgt'

/**
 * Shown instead of the summary when only acquisitions were imported. What to
 * import next is in the Issues panel ("No Disposals Found").
 */
function BuyOnlyNote() {
  return (
    <div className="bg-white shadow rounded-lg p-6" data-testid="buy-only-note">
      <p className="text-sm text-gray-700">
        <span className="font-medium text-gray-900">No capital gains to calculate yet.</span>{' '}
        Your imported transactions include purchases but no sales. See the Issues panel above for what to import.
      </p>
    </div>
  )
}

const UK_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** ISO date (YYYY-MM-DD) as a UK date, e.g. "6 Apr 2024" */
function formatUkDate(isoDate: string): string {
  return UK_DATE.format(new Date(`${isoDate}T00:00:00Z`))
}

/**
 * The headline answer for the selected tax year: whether Capital Gains Tax is
 * due, and separately whether the year still has to be reported on the
 * SA108 pages (owing nothing doesn't mean nothing to report). The worked
 * figures are in "CGT Calculation" below.
 */
function TaxYearAnswer({ summary }: { summary: TaxYearSummaryData }) {
  const need = sa108ReportingNeed(summary)
  const exemptAmount = formatGbpWhole(summary.annualExemptAmount)
  const net = summary.netGainOrLossGbp

  const reason = summary.totalDisposals === 0
    ? 'No disposals this tax year.'
    : need.taxDue
    ? `Net gain of ${formatGbpWhole(net)}, less the ${exemptAmount} annual exempt amount.`
    : net < 0
      ? `Net loss of ${formatGbpWhole(Math.abs(net))}.`
      : `Net gain of ${formatGbpWhole(net)} is within the ${exemptAmount} annual exempt amount.`

  // Why the SA108 pages are needed when no tax is due (HMRC SA108 notes)
  const reportReasons = [
    need.proceedsOverLimit && `your disposals were worth more than ${formatGbpWhole(need.proceedsLimit)}`,
    !need.taxDue && need.gainsOverExemptAmount &&
      `your gains before losses (${formatGbpWhole(summary.totalGainsGbp)}) were more than the ${exemptAmount} annual exempt amount`,
  ].filter((r): r is string => typeof r === 'string')

  // Something to put on the return: tax due, a limit passed, or a loss to claim
  const mustAct = need.taxDue || reportReasons.length > 0 || need.hasLossToClaim

  return (
    <div
      data-testid="tax-year-answer"
      className={`rounded-lg border p-5 space-y-3 ${
        need.taxDue ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Taxable gain {summary.taxYear}
          </div>
          <div className={`text-4xl font-bold mt-1 ${need.taxDue ? 'text-amber-900' : 'text-emerald-900'}`}>
            {formatGbpWhole(summary.taxableGainGbp)}
          </div>
          <p className={`text-sm mt-1 ${need.taxDue ? 'text-amber-800' : 'text-emerald-800'}`}>{reason}</p>
        </div>
        <div
          className={`sm:ml-auto shrink-0 self-start sm:self-center inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
            need.taxDue ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
          }`}
        >
          {need.taxDue ? (
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          )}
          {need.taxDue ? 'CGT to pay' : 'No CGT to pay'}
        </div>
      </div>

      <div
        data-testid="reporting-note"
        className={`flex items-start gap-2 text-sm border-t border-black/5 pt-3 ${mustAct ? 'text-amber-900' : 'text-gray-700'}`}
      >
        {mustAct ? (
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
        ) : (
          <FileText className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
        )}
        <div className="space-y-1">
          {need.taxDue ? (
            <p>
              <span className="font-medium">Report it to HMRC</span> on the capital gains pages (SA108) of your
              Self Assessment return.
            </p>
          ) : reportReasons.length > 0 ? (
            <p>
              <span className="font-medium">You may still need to report this year.</span> If you send a Self
              Assessment return, fill in its capital gains pages (SA108): {reportReasons.join(', and ')}.
            </p>
          ) : need.hasLossToClaim ? (
            <p>
              <span className="font-medium">Report the loss to use it later.</span> To set the{' '}
              {formatGbpWhole(Math.abs(net))} loss against future gains, claim it on the capital gains pages (SA108)
              within 4 years of the end of the tax year.
            </p>
          ) : (
            <p>
              From the disposals you imported, this year doesn&apos;t need the capital gains pages (SA108). Sales
              of other assets count towards the same limits.
            </p>
          )}
          {need.hasLossToClaim && (need.taxDue || reportReasons.length > 0) && (
            <p>
              Claiming the {formatGbpWhole(Math.abs(net))} loss there lets you set it against future gains.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function TaxYearSummary() {
  const cgtResults = useTransactionStore((state) => state.cgtResults)
  const isLoading = useTransactionStore((state) => state.isLoading)
  const selectedTaxYear = useTransactionStore((state) => state.selectedTaxYear)
  const setSelectedTaxYear = useTransactionStore((state) => state.setSelectedTaxYear)
  const hasExportedPDF = useTransactionStore((state) => state.hasExportedPDF)
  const toggleHelpPanelWithContext = useHelpPanelStore((state) => state.toggleWithContext)
  const [showDisposals, setShowDisposals] = useState(false)
  const [showDividends, setShowDividends] = useState(false)
  const [showInterest, setShowInterest] = useState(false)

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
            <p className="text-gray-600 mt-4 font-medium">Calculating tax summary from your data...</p>
            <p className="text-gray-500 text-sm mt-2">Processing disposals and applying HMRC rules</p>
          </div>
        </div>
      </div>
    )
  }

  if (!cgtResults) {
    return null
  }

  if (cgtResults.taxYearSummaries.length === 0) {
    return null
  }

  const currentSummary = cgtResults.taxYearSummaries.find(s => s.taxYear === selectedTaxYear)
    || cgtResults.taxYearSummaries[0]

  if (!currentSummary) {
    return null
  }

  // Check if we have BUY transactions but no SELL transactions (no disposals at all)
  const metadata = cgtResults.metadata
  const hasBuysOnly = metadata && metadata.totalBuys > 0 && metadata.totalSells === 0

  if (hasBuysOnly) {
    return <BuyOnlyNote />
  }

  const hasTaxableGain = currentSummary.taxableGainGbp > 0

  // Box numbers go on the tiles when every disposal is in one SA108 section
  // whose boxes are known for the year (the PDF splits mixed years by section)
  const sa108 = sa108Rows(currentSummary.taxYear, currentSummary.disposals)
  const boxes = sa108.length === 1 ? sa108[0].boxes : null
  const tileLabel = (label: string, box: string | undefined) => (
    <span className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-gray-500 uppercase mb-1">
      <span>{label}</span>
      {box && <span className="normal-case text-gray-400 whitespace-nowrap">Box {box}</span>}
    </span>
  )

  const tiles: { id: string; label: string; box?: string; value: string; tone?: string }[] = [
    { id: 'proceeds', label: 'Proceeds', box: boxes?.proceeds, value: formatGbpWhole(currentSummary.totalProceedsGbp) },
    { id: 'costs', label: 'Allowable costs', box: boxes?.costs, value: formatGbpWhole(currentSummary.totalAllowableCostsGbp) },
    { id: 'gains', label: 'Gains', box: boxes?.gains, value: formatGbpWhole(currentSummary.totalGainsGbp), tone: 'text-green-700' },
    { id: 'losses', label: 'Losses', box: boxes?.losses, value: formatGbpWhole(Math.abs(currentSummary.totalLossesGbp)), tone: 'text-red-700' },
  ]

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-semibold text-gray-900">Tax Year Summary</h2>

            {/* Tax Year Selector Dropdown */}
            <div className="relative">
              <select
                id="tax-year-select"
                aria-label="Tax year"
                value={selectedTaxYear}
                onChange={(e) => setSelectedTaxYear(e.target.value)}
                className="block pl-3 pr-9 py-1 text-base font-semibold text-brand-600 bg-brand-50 border-2 border-brand-200 rounded-md hover:border-brand-400 hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 appearance-none cursor-pointer transition-colors"
              >
                {cgtResults.taxYearSummaries.map((summary) => (
                  <option key={summary.taxYear} value={summary.taxYear}>
                    {summary.taxYear}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-brand-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1" data-testid="tax-year-period">
            {formatUkDate(currentSummary.startDate)} – {formatUkDate(currentSummary.endDate)}
          </p>
        </div>
        <ExportPDFButton />
      </div>

      <div className="p-6 space-y-6">
        <TaxYearAnswer summary={currentSummary} />

        {/* The year's figures, as they go on SA108 */}
        <div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <button
              type="button"
              onClick={() => setShowDisposals(!showDisposals)}
              aria-expanded={showDisposals}
              className="col-span-2 md:col-span-1 bg-gray-50 hover:bg-gray-100 rounded-lg p-4 text-left transition-colors"
            >
              {tileLabel('Disposals', boxes?.number)}
              <span className="block text-2xl font-bold text-gray-900">{currentSummary.totalDisposals}</span>
              <span className="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-brand-600">
                {showDisposals ? 'Hide' : 'View'} disposals
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDisposals ? 'rotate-180' : ''}`} aria-hidden="true" />
              </span>
              {currentSummary.disposals.length !== currentSummary.totalDisposals && (
                <span className="block text-xs text-gray-500 mt-1">
                  {currentSummary.disposals.length} sales; same-day sales of a share count as one
                </span>
              )}
            </button>
            {tiles.map(tile => (
              <div key={tile.id} data-testid={`summary-${tile.id}`} className="bg-gray-50 rounded-lg p-4">
                {tileLabel(tile.label, tile.box)}
                <div className={`text-2xl font-bold ${tile.tone ?? 'text-gray-900'}`}>{tile.value}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {boxes
              ? `Box numbers are from the SA108 "${sa108[0].section}" section. Gains are before losses; losses are shown as positive amounts, as on the form.`
              : sa108.length > 1
                ? 'Totals across shares, cryptoassets and options. The PDF report splits them by SA108 section.'
                : 'Gains are before losses; losses are shown as positive amounts.'}
          </p>
        </div>

        {/* Warning for disposals valued with a missing exchange rate */}
        {(currentSummary.missingFxDisposals ?? 0) > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" data-testid="missing-fx-warning">
            <h4 className="text-sm font-medium text-red-800">Missing Exchange Rates</h4>
            <p className="mt-1 text-sm text-red-700">
              {currentSummary.missingFxDisposals} disposal{currentSummary.missingFxDisposals !== 1 ? 's' : ''} use a transaction with no GBP exchange rate, valued at £0.
              The gains and losses above are wrong until the rate is available. Try reloading, or choose a different FX source.
            </p>
          </div>
        )}

        {currentSummary.incompleteDisposals > 0 && (
          <IssuePointer testId="incomplete-disposals-pointer">
            {currentSummary.incompleteDisposals} disposal{currentSummary.incompleteDisposals !== 1 ? 's' : ''} this tax year could
            not be fully matched, so the figures above cover only the matched shares. See "Incomplete Disposal Data" in the Issues panel above.
          </IssuePointer>
        )}

        {/* Disposal Records Panel */}
        {showDisposals && (
          <DisposalRecords
            containerClassName="bg-white border border-gray-200 rounded-lg overflow-hidden"
            showHeader={true}
            headerTitle="Disposal Records"
          />
        )}

        {/* CGT Calculation: the working behind the answer, collapsed by default */}
        <details className="group bg-white border border-gray-200 rounded-lg" data-testid="cgt-calculation">
          <summary className="flex items-center justify-between gap-3 px-6 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span>
              <h3 className="inline text-lg font-semibold text-gray-900">CGT Calculation</h3>
              <span className="block sm:inline sm:ml-2 text-sm text-gray-500">How the taxable gain is worked out</span>
            </span>
            <ChevronDown className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>

          <div className="space-y-3 px-6 pb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Total Gains</span>
              <span className="font-medium text-gray-900">
                {formatGbp(currentSummary.totalGainsGbp)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-700">Total Losses</span>
              <span className="font-medium text-gray-900">
                {formatGbp(currentSummary.totalLossesGbp)}
              </span>
            </div>

            <div className="border-t border-gray-200 pt-2">
              <div className="flex justify-between items-center font-semibold">
                <span className="text-gray-700">Net Gain/(Loss)</span>
                <span className={currentSummary.netGainOrLossGbp >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {formatGbp(currentSummary.netGainOrLossGbp)}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-700">
                Less: Annual Exempt Amount
                <Tooltip content="View HMRC official rates and allowances">
                  <a
                    href="https://www.gov.uk/government/publications/rates-and-allowances-capital-gains-tax/capital-gains-tax-rates-and-annual-tax-free-allowances"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-brand-600 hover:text-brand-800 underline text-xs"
                  >
                    (source)
                  </a>
                </Tooltip>
              </span>
              <span className="font-medium text-gray-900">
                ({formatGbpWhole(currentSummary.annualExemptAmount)})
              </span>
            </div>

            <div className="border-t border-gray-300 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Taxable Gain</span>
                <span className={`text-2xl font-bold ${hasTaxableGain ? 'text-red-700' : 'text-green-700'}`}>
                  {formatGbp(currentSummary.taxableGainGbp)}
                </span>
              </div>
            </div>
          </div>
        </details>

        {/* Tax Year-Specific Features (e.g., CGT Rate Change 2024) */}
        <TaxYearFeaturesRenderer summary={currentSummary} />

        {/* Pointer to the per-transaction detail */}
        <p className="text-sm text-gray-600">
          <a href="#transactions" className="font-medium text-brand-600 hover:text-brand-800 underline">
            See every transaction
          </a>
          {' '}with the FX rate used and the HMRC matching rule applied (Same Day, 30-Day, Section 104).
        </p>

        {/* Other Income Section */}
        {(currentSummary.totalDividends > 0 || currentSummary.totalInterest > 0) && (
          <>
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Other Income (for reference)</h3>
              <p className="text-xs text-gray-500 mb-3">
                Dividends and interest are taxed separately from capital gains and do not affect your CGT calculation above.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Dividend Income Card */}
                {currentSummary.totalDividends > 0 && (
                  <button
                    onClick={() => {
                      setShowDividends(!showDividends)
                      if (!showDividends) setShowInterest(false)
                    }}
                    className="bg-gray-50 hover:bg-gray-100 rounded-lg p-3 text-left transition-colors border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 uppercase mb-0.5">Dividend Income</div>
                        <div className="text-xl font-bold text-gray-900 flex items-center gap-2">
                          {formatGbpWhole(currentSummary.grossDividendsGbp)}
                          <span className="text-xs font-normal text-gray-600">
                            ({currentSummary.totalDividends} {currentSummary.totalDividends === 1 ? 'payment' : 'payments'})
                          </span>
                        </div>
                      </div>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showDividends ? 'transform rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                )}

                {/* Interest Income Card */}
                {currentSummary.totalInterest > 0 && (
                  <button
                    onClick={() => {
                      setShowInterest(!showInterest)
                      if (!showInterest) setShowDividends(false)
                    }}
                    className="bg-gray-50 hover:bg-gray-100 rounded-lg p-3 text-left transition-colors border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 uppercase mb-0.5">Interest Income</div>
                        <div className="text-xl font-bold text-gray-900 flex items-center gap-2">
                          {formatGbpWhole(currentSummary.grossInterestGbp)}
                          <span className="text-xs font-normal text-gray-600">
                            ({currentSummary.totalInterest} {currentSummary.totalInterest === 1 ? 'payment' : 'payments'})
                          </span>
                        </div>
                      </div>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showInterest ? 'transform rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {showDividends && currentSummary.totalDividends > 0 && (
              <DividendDetailsPanel summary={currentSummary} onHelp={() => toggleHelpPanelWithContext('dividend')} />
            )}

            {showInterest && currentSummary.totalInterest > 0 && (
              <InterestDetailsPanel summary={currentSummary} onHelp={() => toggleHelpPanelWithContext('interest')} />
            )}
          </>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-gray-500 italic">
          This is an estimate based on HMRC guidance. Always consult a qualified tax professional for your specific situation.
        </p>

        {/* Buy Me A Coffee - Only shown after PDF export */}
        {hasExportedPDF && <BuyMeACoffee />}
      </div>
    </div>
  )
}
