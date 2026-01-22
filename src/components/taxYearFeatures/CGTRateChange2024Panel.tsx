/**
 * CGT Rate Change Panel for Tax Year 2024/25
 *
 * Displays information about the 30 October 2024 CGT rate change
 * and guides users on how to complete their Self Assessment.
 *
 * Shows different messages based on whether Box 51 adjustment is required:
 * - Required: When any disposal on/after 30 Oct AND net gain > £3,000 AEA
 * - Not required: All disposals before 30 Oct, OR net gain ≤ £3,000 AEA
 */

import type { CGTRateChange2024Data } from '../../lib/cgt/taxYearFeatures'

interface CGTRateChange2024PanelProps {
  data: CGTRateChange2024Data
}

/**
 * Format a number as GBP currency
 */
function formatGBP(value: number): string {
  return `£${value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** HMRC reference URL for CGT rate changes */
const HMRC_CGT_RATE_CHANGE_URL =
  'https://www.gov.uk/government/publications/changes-to-the-rates-of-capital-gains-tax'

/**
 * Panel showing CGT rate change information when NO adjustment is required.
 * This is an informational blue panel.
 */
function NoAdjustmentRequiredPanel({ data }: CGTRateChange2024PanelProps) {
  const isGainBelowAEA = data.totalNetGainOrLoss <= data.annualExemptAmount
  const allDisposalsBeforeChange = data.disposalCountAfterRateChange === 0

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start">
        <svg
          className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">
            2024 CGT Rate Change — No Adjustment Required{' '}
            <a
              href={HMRC_CGT_RATE_CHANGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline text-xs font-normal"
            >
              (HMRC)
            </a>
          </h4>
          <p className="text-xs text-blue-700">
            {isGainBelowAEA ? (
              <>
                Your net gain ({formatGBP(data.totalNetGainOrLoss)}) is below
                the Annual Exempt Amount ({formatGBP(data.annualExemptAmount)}).
                No CGT adjustment is needed despite the 30 October 2024 rate
                change.
              </>
            ) : allDisposalsBeforeChange ? (
              <>
                All your disposals were before 30 October 2024, so your Self
                Assessment will calculate correctly using the rates that
                applied (Basic rate: {data.oldRates.basic}%, Higher rate:{' '}
                {data.oldRates.higher}%). No adjustment needed.
              </>
            ) : (
              <>
                No CGT adjustment is required for this tax year. Your Self
                Assessment will calculate correctly.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Panel showing CGT rate change information when adjustment IS required.
 * This is a warning amber panel with detailed instructions.
 */
function AdjustmentRequiredPanel({ data }: CGTRateChange2024PanelProps) {
  const hasDisposalsInBothPeriods =
    data.disposalCountBeforeRateChange > 0 && data.disposalCountAfterRateChange > 0

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start">
        <svg
          className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-semibold text-amber-900 mb-2">
            Action Required: 2024 CGT Rate Change Adjustment (Box 51){' '}
            <a
              href={HMRC_CGT_RATE_CHANGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 hover:text-amber-800 underline text-xs font-normal"
            >
              (HMRC)
            </a>
          </h4>
          <p className="text-xs text-amber-700 mb-3">
            From 30 October 2024, CGT rates increased (
            <strong>
              Basic rate: {data.oldRates.basic}% → {data.newRates.basic}%
            </strong>
            ,{' '}
            <strong>
              Higher rate: {data.oldRates.higher}% → {data.newRates.higher}%
            </strong>
            ). You have{' '}
            {hasDisposalsInBothPeriods
              ? 'disposals in both periods'
              : 'disposals after 30 October'}
            , so your Self Assessment will not calculate the correct tax
            automatically. Use{' '}
            <a
              href="https://www.gov.uk/guidance/work-out-your-capital-gains-tax-adjustment-for-the-2024-to-2025-tax-year"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-amber-900 font-medium"
            >
              HMRC's official calculator
            </a>{' '}
            to work out the Box 51 adjustment.
          </p>

          {/* Split figures display */}
          <div className="space-y-2 text-sm">
            {/* Before 30 Oct section */}
            {(data.gainsBeforeRateChange > 0 ||
              data.lossesBeforeRateChange < 0) && (
              <>
                <div className="flex justify-between items-center py-1 border-b border-amber-200">
                  <span className="text-amber-800 font-medium">
                    Before 30 Oct 2024 ({data.oldRates.basic}%/
                    {data.oldRates.higher}% rates)
                  </span>
                  <span className="text-xs text-amber-600">
                    {data.disposalCountBeforeRateChange} disposal
                    {data.disposalCountBeforeRateChange !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center pl-3">
                  <span className="text-amber-700">Gains</span>
                  <span className="font-medium text-green-700">
                    {formatGBP(data.gainsBeforeRateChange)}
                  </span>
                </div>
                <div className="flex justify-between items-center pl-3">
                  <span className="text-amber-700">Losses</span>
                  <span className="font-medium text-red-700">
                    ({formatGBP(Math.abs(data.lossesBeforeRateChange))})
                  </span>
                </div>
                <div className="flex justify-between items-center pl-3 pb-2">
                  <span className="text-amber-800 font-medium">Net</span>
                  <span
                    className={`font-semibold ${
                      data.netGainOrLossBeforeRateChange >= 0
                        ? 'text-green-700'
                        : 'text-red-700'
                    }`}
                  >
                    {formatGBP(data.netGainOrLossBeforeRateChange)}
                  </span>
                </div>
              </>
            )}

            {/* After 30 Oct section */}
            <div
              className={`flex justify-between items-center py-1 border-b border-amber-200 ${
                data.disposalCountBeforeRateChange > 0 ? 'border-t pt-3' : ''
              }`}
            >
              <span className="text-amber-800 font-medium">
                From 30 Oct 2024 ({data.newRates.basic}%/{data.newRates.higher}%
                rates)
              </span>
              <span className="text-xs text-amber-600">
                {data.disposalCountAfterRateChange} disposal
                {data.disposalCountAfterRateChange !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex justify-between items-center pl-3">
              <span className="text-amber-700">Gains</span>
              <span className="font-medium text-green-700">
                {formatGBP(data.gainsAfterRateChange)}
              </span>
            </div>
            <div className="flex justify-between items-center pl-3">
              <span className="text-amber-700">Losses</span>
              <span className="font-medium text-red-700">
                ({formatGBP(Math.abs(data.lossesAfterRateChange))})
              </span>
            </div>
            <div className="flex justify-between items-center pl-3">
              <span className="text-amber-800 font-medium">Net</span>
              <span
                className={`font-semibold ${
                  data.netGainOrLossAfterRateChange >= 0
                    ? 'text-green-700'
                    : 'text-red-700'
                }`}
              >
                {formatGBP(data.netGainOrLossAfterRateChange)}
              </span>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-3 pt-3 border-t border-amber-200">
            <p className="text-xs text-amber-800 font-semibold mb-1">
              How to complete your Self Assessment:
            </p>
            <ol className="text-xs text-amber-700 ml-4 space-y-1 list-decimal">
              <li>
                Open{' '}
                <a
                  href="https://www.gov.uk/guidance/work-out-your-capital-gains-tax-adjustment-for-the-2024-to-2025-tax-year"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  HMRC's CGT adjustment calculator
                </a>
              </li>
              <li>Enter the figures shown above for each period</li>
              <li>The calculator will give you a Box 51 adjustment amount</li>
              <li>
                Enter this amount in <strong>Box 51</strong> (paper SA108) or{' '}
                <strong>"Adjustment to CGT"</strong> field (online)
              </li>
              <li>
                Export this page as PDF and attach as evidence to your return
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Main CGT Rate Change 2024 Panel Component
 *
 * Renders the appropriate panel based on whether adjustment is required.
 */
export function CGTRateChange2024Panel({ data }: CGTRateChange2024PanelProps) {
  if (data.requiresAdjustment) {
    return <AdjustmentRequiredPanel data={data} />
  }
  return <NoAdjustmentRequiredPanel data={data} />
}
