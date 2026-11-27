import { ShieldCheck } from 'lucide-react'
import { hmrcRulesBadge } from '../lib/freshness'
import { Tooltip } from './Tooltip'

/**
 * A small "HMRC 2025/26" badge with a shield in the header, shown only while the last HMRC
 * rules check confirms the last ended tax year and is recent (hmrcRulesBadge).
 * Hover or tap shows what it means; the footer links to the check log
 */
export function HmrcRulesBadge({ className = '' }: { className?: string }) {
  // Today in the browser, so the badge hides on time without a new build
  const badge = hmrcRulesBadge(new Date().toLocaleDateString('en-CA'))
  if (!badge) return null
  const details =
    `Up to date with HMRC rules for ${badge.taxYear}: the matching rules and allowances were checked on ` +
    `${badge.checkedOn} against HMRC's published guidance and the legislation.`
  return (
    <Tooltip content={details} className={`leading-none ${className}`}>
      <button
        type="button"
        data-testid="hmrc-rules-badge"
        aria-label={details}
        className="inline-flex items-center gap-1 align-top whitespace-nowrap text-[11px] font-medium leading-4 text-gray-600 hover:text-gray-900 cursor-help"
      >
        <ShieldCheck className="h-3 w-3 shrink-0 text-brand-600" strokeWidth={2.25} aria-hidden="true" />
        HMRC {badge.taxYear}
      </button>
    </Tooltip>
  )
}
