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
 * The answer for the selected tax year, in two lines: whether Capital Gains
 * Tax is due, and separately whether the year still goes on the SA108 pages
 * (owing nothing doesn't mean nothing to report).
 */
function TaxYearAnswer({ summary }: { summary: TaxYearSummaryData }) {
  const need = sa108ReportingNeed(summary)
  const exemptAmount = formatGbpWhole(summary.annualExemptAmount)
  const net = summary.netGainOrLossGbp

  const reason = need.taxDue
    ? `taxable gain of ${formatGbpWhole(summary.taxableGainGbp)}: net gain of ${formatGbpWhole(net)} less the ${exemptAmount} annual exempt amount`
    : net < 0
      ? `net loss of ${formatGbpWhole(Math.abs(net))}`
      : `net gain of ${formatGbpWhole(net)} is within the ${exemptAmount} annual exempt amount`

  // Why the SA108 pages are needed when no tax is due (HMRC SA108 notes)
  const reportReasons = [
    need.proceedsOverLimit && `your disposals were worth more than ${formatGbpWhole(need.proceedsLimit)}`,
    !need.taxDue && need.gainsOverExemptAmount &&
      `your gains before losses (${formatGbpWhole(summary.totalGainsGbp)}) were more than the ${exemptAmount} annual exempt amount`,
  ].filter((r): r is string => typeof r === 'string')

  // Something to put on the return: tax due, a limit passed, or a loss to claim
  const mustAct = need.taxDue || reportReasons.length > 0 || need.hasLossToClaim

  return (
    <div data-testid="tax-year-answer" className="space-y-3">
      <p className="flex items-start gap-2 text-lg">
        {need.taxDue ? (
          <AlertTriangle className="w-5 h-5 mt-1 shrink-0 text-amber-600" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="w-5 h-5 mt-1 shrink-0 text-emerald-600" aria-hidden="true" />
        )}
        <span>
          <span className="font-semibold text-gray-900">{need.taxDue ? 'CGT to pay' : 'No CGT to pay'}</span>
          <span className="text-gray-600"> · {reason}</span>
        </span>
      </p>

      <div
        data-testid="reporting-note"
        className={`flex items-start gap-2 text-sm ${
          mustAct ? 'text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2' : 'text-gray-600 px-0.5'
        }`}
      >
        {mustAct ? (
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
        ) : (
          <FileText className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
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
          {need.hasLossToClaim && reportReasons.length > 0 && (
            <p>Claiming the {formatGbpWhole(Math.abs(net))} loss there lets you set it against future gains.</p>
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

  if (!cgtResults || cgtResults.taxYearSummaries.length === 0) {
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

  const hasDisposals = currentSummary.totalDisposals > 0
  const hasTaxableGain = currentSummary.taxableGainGbp > 0
  const hasOtherIncome = currentSummary.totalDividends > 0 || currentSummary.totalInterest > 0

  // Box numbers are shown when every disposal is in one SA108 section whose
  // boxes are known for the year (the PDF splits mixed years by section)
  const sa108 = sa108Rows(currentSummary.taxYear, currentSummary.disposals)
  const boxes = sa108.length === 1 ? sa108[0].boxes : null

  const figures: { id: string; label: string; box?: string; value: string; tone?: string }[] = [
    { id: 'proceeds', label: 'Proceeds', box: boxes?.proceeds, value: formatGbpWhole(currentSummary.totalProceedsGbp) },
    { id: 'costs', label: 'Allowable costs', box: boxes?.costs, value: formatGbpWhole(currentSummary.totalAllowableCostsGbp) },
    { id: 'gains', label: 'Gains', box: boxes?.gains, value: formatGbpWhole(currentSummary.totalGainsGbp), tone: 'text-green-700' },
    { id: 'losses', label: 'Losses', box: boxes?.losses, value: formatGbpWhole(Math.abs(currentSummary.totalLossesGbp)), tone: 'text-red-700' },
  ]
  const figureLabel = (label: string, box: string | undefined) => (
    <span className="block text-xs text-gray-500">
      {label}
      {box && <span className="text-gray-400"> · box {box}</span>}
    </span>
  )

  const incomeButton = (label: string, amountGbp: number, count: number, open: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 px-3 py-1 text-sm transition-colors"
    >
      <span className="text-gray-700">{label}</span>
      <span className="font-semibold text-gray-900">{formatGbpWhole(amountGbp)}</span>
      <span className="text-gray-500">({count} {count === 1 ? 'payment' : 'payments'})</span>
      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
  )

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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

          <span className="text-sm text-gray-500" data-testid="tax-year-period">
            {formatUkDate(currentSummary.startDate)} – {formatUkDate(currentSummary.endDate)}
          </span>
        </div>
        <ExportPDFButton />
      </div>

      <div className="p-6 space-y-5">
        {/* Shown after a PDF export, next to the button that made it */}
        {hasExportedPDF && <BuyMeACoffee />}

        {hasDisposals ? (
          <TaxYearAnswer summary={currentSummary} />
        ) : (
          <p data-testid="tax-year-answer" className="text-gray-700">
            No disposals in {currentSummary.taxYear} in the transactions you imported, so there are no capital gains
            to report for this year.
          </p>
        )}

        {/* Warning for disposals valued with a missing exchange rate */}
        {(currentSummary.missingFxDisposals ?? 0) > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" data-testid="missing-fx-warning">
            <h4 className="text-sm font-medium text-red-800">Missing Exchange Rates</h4>
            <p className="mt-1 text-sm text-red-700">
              {currentSummary.missingFxDisposals} disposal{currentSummary.missingFxDisposals !== 1 ? 's' : ''} use a transaction with no GBP exchange rate, valued at £0.
              The gains and losses below are wrong until the rate is available. Try reloading, or choose a different FX source.
            </p>
          </div>
        )}

        {currentSummary.incompleteDisposals > 0 && (
          <IssuePointer testId="incomplete-disposals-pointer">
            {currentSummary.incompleteDisposals} disposal{currentSummary.incompleteDisposals !== 1 ? 's' : ''} this tax year could
            not be fully matched, so the figures below cover only the matched shares. See "Incomplete Disposal Data" in the Issues panel above.
          </IssuePointer>
        )}

        {hasDisposals && (
          <>
            {/* The year's figures, as they go on SA108 */}
            <div>
              <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg bg-gray-50 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowDisposals(!showDisposals)}
                  aria-expanded={showDisposals}
                  className="text-left group"
                >
                  {figureLabel('Disposals', boxes?.number)}{' '}
                  <span className="flex items-center gap-1 text-lg font-semibold text-brand-600 group-hover:text-brand-800">
                    {currentSummary.totalDisposals}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showDisposals ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </span>
                  {currentSummary.disposals.length !== currentSummary.totalDisposals && (
                    <span className="block text-xs text-gray-500">
                      {' '}{currentSummary.disposals.length} sales; same-day sales of a share count as one
                    </span>
                  )}
                </button>
                {figures.map(figure => (
                  <div key={figure.id} data-testid={`summary-${figure.id}`}>
                    {figureLabel(figure.label, figure.box)}{' '}
                    <span className={`block text-lg font-semibold ${figure.tone ?? 'text-gray-900'}`}>{figure.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {boxes
                  ? `Boxes from the SA108 "${sa108[0].section}" section; losses shown as positive amounts, as on the form. `
                  : sa108.length > 1
                    ? 'Totals across shares, cryptoassets and options; the PDF report splits them by SA108 section. '
                    : 'Gains are before losses; losses are shown as positive amounts. '}
                <a href="#transactions" className="text-brand-600 hover:text-brand-800 underline">
                  See every transaction
                </a>{' '}
                with the FX rate and HMRC matching rule used.
              </p>
            </div>

            {/* Disposal Records Panel */}
            {showDisposals && (
              <DisposalRecords
                containerClassName="bg-white border border-gray-200 rounded-lg overflow-hidden"
                showHeader={true}
                headerTitle="Disposal Records"
              />
            )}

            {/* CGT Calculation: the working behind the answer, collapsed by default */}
            <details className="group" data-testid="cgt-calculation">
              <summary className="flex items-start gap-1 cursor-pointer list-none text-sm text-brand-600 hover:text-brand-800 [&::-webkit-details-marker]:hidden">
                <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 -rotate-90 transition-transform group-open:rotate-0" aria-hidden="true" />
                <span>
                  <h3 className="inline font-medium">CGT Calculation</h3>
                  <span className="text-gray-500">: how the taxable gain is worked out</span>
                </span>
              </summary>

              <div className="mt-3 space-y-3 rounded-lg border border-gray-200 p-5">
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
                    <span className="font-bold text-gray-900">Taxable Gain</span>
                    <span className={`text-xl font-bold ${hasTaxableGain ? 'text-red-700' : 'text-green-700'}`}>
                      {formatGbp(currentSummary.taxableGainGbp)}
                    </span>
                  </div>
                </div>
              </div>
            </details>

            {/* Tax Year-Specific Features (e.g., CGT Rate Change 2024) */}
            <TaxYearFeaturesRenderer summary={currentSummary} />
          </>
        )}

        {/* Other income: reference only, taxed separately from capital gains */}
        {hasOtherIncome && (
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">
                Other income <span className="text-gray-400">(taxed separately, not part of CGT)</span>
              </span>
              {currentSummary.totalDividends > 0 &&
                incomeButton('Dividend Income', currentSummary.grossDividendsGbp, currentSummary.totalDividends, showDividends, () => {
                  setShowDividends(!showDividends)
                  if (!showDividends) setShowInterest(false)
                })}
              {currentSummary.totalInterest > 0 &&
                incomeButton('Interest Income', currentSummary.grossInterestGbp, currentSummary.totalInterest, showInterest, () => {
                  setShowInterest(!showInterest)
                  if (!showInterest) setShowDividends(false)
                })}
            </div>

            {showDividends && currentSummary.totalDividends > 0 && (
              <DividendDetailsPanel summary={currentSummary} onHelp={() => toggleHelpPanelWithContext('dividend')} />
            )}

            {showInterest && currentSummary.totalInterest > 0 && (
              <InterestDetailsPanel summary={currentSummary} onHelp={() => toggleHelpPanelWithContext('interest')} />
            )}
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-gray-500 italic">
          This is an estimate based on HMRC guidance. Always consult a qualified tax professional for your specific situation.
        </p>
      </div>
    </div>
  )
}
