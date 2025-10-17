import { useState } from 'react'

/**
 * BuyMeACoffee component
 *
 * A subtle, non-intrusive donation button that appears after users export their PDF report.
 * Uses best practices for donation requests:
 * - Only appears after user has received value (PDF export)
 * - Emphasizes gratitude and optional nature
 * - Clear value proposition (supporting open-source development)
 * - Visually distinct but not aggressive
 * - Can be dismissed by user
 */

export function BuyMeACoffee() {
  const STRIPE_DONATION_LINK = 'https://buy.stripe.com/dRm8wRb1b2bQfarfaHeIw00'
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 shadow-sm relative">
      {/* Close Button */}
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <div className="flex items-start gap-3">
        {/* Coffee Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <span className="text-3xl">☕</span>
        </div>

        {/* Content */}
        <div className="flex-1 pr-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-1">
            Found this tool helpful?
          </h4>
          <p className="text-xs text-gray-700 mb-3">
            This tool is free and open-source. If it saved you time or money, consider supporting its development with a small donation.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <a
              href={STRIPE_DONATION_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              Buy Me a Coffee
            </a>

            <span className="text-xs text-gray-600 italic">
              I'll drink this coffee for you!
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
