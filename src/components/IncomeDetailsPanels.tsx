import type { ReactNode } from 'react'
import type { TaxYearSummary } from '../types/cgt'
import { Tooltip } from './Tooltip'
import { formatGbp } from '../utils/currency'

const SA106_URL = 'https://www.gov.uk/government/publications/self-assessment-foreign-sa106'
const TAXED_TWICE_URL = 'https://www.gov.uk/tax-foreign-income/taxed-twice'
const SAVINGS_INTEREST_URL = 'https://www.gov.uk/apply-tax-free-interest-on-savings'

interface PanelProps {
  summary: TaxYearSummary
  /** Open the help panel on this income type */
  onHelp: () => void
}

/**
 * Dividend income for the selected tax year: taxable amount after the
 * dividend allowance, SA106 figures and whether reporting is required.
 */
export function DividendDetailsPanel({ summary, onHelp }: PanelProps) {
  // HMRC compares GROSS dividends with the allowance (not net after withholding)
  // See: https://www.gov.uk/government/publications/self-assessment-foreign-sa106
  const exceedsAllowance = summary.grossDividendsGbp > summary.dividendAllowance
  const allowance = `£${summary.dividendAllowance.toLocaleString('en-GB')}`

  return (
    <IncomePanel
      title="Dividend Income Details"
      subtitle="Dividend tax is calculated separately from capital gains tax."
      helpLabel="Learn about dividend tax"
      onHelp={onHelp}
    >
      <div className="space-y-3">
        <AmountRow label="Gross Dividends (taxable amount)" amount={formatGbp(summary.grossDividendsGbp)} />
        <AmountRow
          label={<>Less: Dividend Allowance<SourceLink href="https://www.gov.uk/tax-on-dividends" tooltip="View HMRC tax on dividends information" text="(source)" /></>}
          amount={`(£${summary.dividendAllowance.toLocaleString('en-GB', { maximumFractionDigits: 0 })})`}
        />
        <div className="border-t border-purple-300 pt-3">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-purple-900">Taxable Dividends</span>
            <span className={`text-2xl font-bold ${exceedsAllowance ? 'text-red-700' : 'text-green-700'}`}>
              {formatGbp(Math.max(0, summary.grossDividendsGbp - summary.dividendAllowance))}
            </span>
          </div>
        </div>
      </div>

      {summary.grossDividendsGbp > 0 && (
        <WithholdingSummary
          title="SA106 Foreign Income Summary"
          formLinkText="(form)"
          grossLabel="Gross Dividends (before tax withheld)"
          grossGbp={summary.grossDividendsGbp}
          withheldGbp={summary.totalWithholdingTaxGbp}
          netLabel="Net Dividends Received"
          netGbp={summary.grossDividendsGbp - summary.totalWithholdingTaxGbp}
        >
          Use these figures when completing SA106 (Foreign). You may be able to claim Foreign Tax Credit Relief for tax withheld.
        </WithholdingSummary>
      )}

      {exceedsAllowance ? (
        <Notice tone="warning" title="Dividend Reporting Required">
          Your gross dividends exceed the {allowance} allowance.
          {summary.grossDividendsGbp > 10000
            ? ' You must complete a Self Assessment tax return.'
            : ' You must inform HMRC (via Self Assessment if dividends exceed £10,000).'}
        </Notice>
      ) : (
        <Notice tone="ok" title="Within Dividend Allowance">
          Your gross dividends are within the {allowance} allowance. No dividend tax is due.
        </Notice>
      )}
    </IncomePanel>
  )
}

/**
 * Interest income for the selected tax year, with the gross/net split when
 * tax was withheld at source.
 */
export function InterestDetailsPanel({ summary, onHelp }: PanelProps) {
  const hasWithholding = summary.interestWithholdingTaxGbp > 0

  return (
    <IncomePanel
      title="Interest Income Details"
      subtitle="Interest tax is calculated separately from capital gains tax."
      helpLabel="Learn about interest tax"
      onHelp={onHelp}
    >
      <div className="space-y-3">
        {hasWithholding ? (
          <>
            <AmountRow
              label={<>Gross Interest (taxable amount)<SourceLink href={SA106_URL} tooltip="View HMRC guidance on foreign interest" text="(why?)" /></>}
              amount={formatGbp(summary.grossInterestGbp)}
            />
            <AmountRow
              label={<>Tax Withheld at Source<SourceLink href={TAXED_TWICE_URL} tooltip="View Foreign Tax Credit Relief guidance" text="(relief)" /></>}
              amount={formatGbp(-summary.interestWithholdingTaxGbp)}
            />
            <div className="border-t border-purple-300 pt-2">
              <div className="flex justify-between items-center font-semibold">
                <span className="text-purple-800">Net Interest Received</span>
                <span className="text-purple-900">{formatGbp(summary.totalInterestGbp)}</span>
              </div>
            </div>
          </>
        ) : (
          <AmountRow
            label={<>Total Interest Received (taxable amount)<SourceLink href={SAVINGS_INTEREST_URL} tooltip="View HMRC savings interest information" text="(source)" /></>}
            amount={formatGbp(summary.totalInterestGbp)}
          />
        )}

        <div className="py-2">
          <p className="text-sm text-purple-800">
            <strong>Personal Savings Allowance:</strong>
            {' '}£1,000 (basic rate), £500 (higher rate), or £0 (additional rate)
            <SourceLink href={SAVINGS_INTEREST_URL} tooltip="View HMRC savings interest information" text="(source)" />
          </p>
          <p className="text-sm text-purple-700 mt-1">
            Interest above your allowance is taxed at your income tax rate (20%, 40%, or 45%).
          </p>
        </div>
      </div>

      {hasWithholding && (
        <WithholdingSummary
          title="Interest with Tax Withheld"
          formLinkText="(SA106)"
          grossLabel="Gross Interest (before tax withheld)"
          grossGbp={summary.grossInterestGbp}
          withheldGbp={summary.interestWithholdingTaxGbp}
          netLabel="Net Interest Received"
          netGbp={summary.totalInterestGbp}
        >
          <strong>For UK Self Assessment:</strong> Report the gross interest ({formatGbp(summary.grossInterestGbp)}) as
          foreign income. If the tax was withheld by a foreign country, you may be able to claim Foreign Tax Credit
          Relief for the {formatGbp(summary.interestWithholdingTaxGbp)} withheld.
          <SourceLink href={TAXED_TWICE_URL} tooltip="View Foreign Tax Credit Relief guidance" text="Learn more" tone="amber" small={false} />
        </WithholdingSummary>
      )}
    </IncomePanel>
  )
}

function IncomePanel({ title, subtitle, helpLabel, onHelp, children }: {
  title: string
  subtitle: string
  helpLabel: string
  onHelp: () => void
  children: ReactNode
}) {
  return (
    <div className="bg-white border border-purple-200 rounded-lg overflow-hidden">
      <div className="bg-purple-50 px-6 py-4 border-b border-purple-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-purple-900">{title}</h3>
            <p className="text-sm text-purple-700 mt-1">{subtitle}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onHelp()
            }}
            className="p-1 rounded hover:bg-purple-100 transition-colors flex-shrink-0"
            aria-label={helpLabel}
          >
            <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  )
}

function AmountRow({ label, amount }: { label: ReactNode; amount: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-purple-800">{label}</span>
      <span className="font-medium text-purple-900">{amount}</span>
    </div>
  )
}

/** An external guidance link with a tooltip, as used beside figures */
function SourceLink({ href, tooltip, text, tone = 'purple', small = true }: {
  href: string
  tooltip: string
  text: string
  tone?: 'purple' | 'amber'
  small?: boolean
}) {
  const colours = tone === 'purple'
    ? 'text-purple-600 hover:text-purple-800'
    : 'text-amber-600 hover:text-amber-800'
  return (
    <Tooltip content={tooltip}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`ml-1 ${colours} underline ${small ? 'text-xs' : ''}`}
      >
        {text}
      </a>
    </Tooltip>
  )
}

/** Amber box with the gross / withheld / net figures to enter on SA106 */
function WithholdingSummary({ title, formLinkText, grossLabel, grossGbp, withheldGbp, netLabel, netGbp, children }: {
  title: string
  formLinkText: string
  grossLabel: string
  grossGbp: number
  withheldGbp: number
  netLabel: string
  netGbp: number
  children: ReactNode
}) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start">
        <svg className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1.581.814L10 13.197l-4.419 3.617A1 1 0 014 16V4z" clipRule="evenodd" />
        </svg>
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-semibold text-amber-900 mb-2">
            {title}
            <span className="font-normal">
              <SourceLink href={SA106_URL} tooltip="View HMRC SA106 form guidance" text={formLinkText} tone="amber" />
            </span>
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-amber-800">{grossLabel}</span>
              <span className="font-medium text-amber-900">{formatGbp(grossGbp)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-amber-800">Tax Withheld at Source</span>
              <span className="font-medium text-amber-900">{formatGbp(withheldGbp)}</span>
            </div>
            <div className="border-t border-amber-300 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-amber-800 font-medium">{netLabel}</span>
                <span className="font-semibold text-amber-900">{formatGbp(netGbp)}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-amber-700 mt-3">{children}</p>
        </div>
      </div>
    </div>
  )
}

function Notice({ tone, title, children }: { tone: 'warning' | 'ok'; title: string; children: ReactNode }) {
  const styles = tone === 'warning'
    ? { box: 'bg-yellow-50 border-yellow-200', icon: 'text-yellow-400', title: 'text-yellow-800', body: 'text-yellow-700',
        path: 'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z' }
    : { box: 'bg-green-50 border-green-200', icon: 'text-green-400', title: 'text-green-800', body: 'text-green-700',
        path: 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' }
  return (
    <div className={`${styles.box} border rounded-lg p-4`}>
      <div className="flex">
        <svg className={`h-5 w-5 ${styles.icon} mt-0.5 flex-shrink-0`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d={styles.path} clipRule="evenodd" />
        </svg>
        <div className="ml-3">
          <h4 className={`text-sm font-medium ${styles.title}`}>{title}</h4>
          <p className={`mt-1 text-sm ${styles.body}`}>{children}</p>
        </div>
      </div>
    </div>
  )
}
