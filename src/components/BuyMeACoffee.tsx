import { useState } from 'react'
import { CoffeeCup } from './CoffeeCup'

const STRIPE_DONATION_LINK = 'https://buy.stripe.com/dRm8wRb1b2bQfarfaHeIw00'
const GITHUB_REPO_URL = 'https://github.com/coffee-cpu/capital-gains-uk-101'

/**
 * BuyMeACoffee component
 *
 * A friendly, dismissible tip card. On the tax year summary it appears only
 * after the user has exported their PDF report, i.e. after they got value.
 * The animated cup pours on mount and pours again when either button is clicked.
 *
 * "Star on GitHub" is a secondary, free way to say thanks.
 *
 * Both are plain links: no third-party widget or script is loaded, so nothing
 * leaves the browser until the user clicks.
 */
export function BuyMeACoffee() {
  const [isDismissed, setIsDismissed] = useState(false)
  const [pourCount, setPourCount] = useState(0)
  const thanked = pourCount > 0

  if (isDismissed) {
    return null
  }

  return (
    <div className="coffee-card bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 shadow-sm relative">
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-center gap-4">
        {/* Re-keying the cup replays the pour */}
        <CoffeeCup key={pourCount} className="w-16 h-16 flex-shrink-0" />

        <div className="flex-1 pr-6">
          {/* Only the text changes after a click: the buttons stay, so focus is kept and both remain usable */}
          <div aria-live="polite">
            <h4 className="text-sm font-semibold text-gray-900 mb-1">
              {thanked ? 'Thank you! ☕' : 'Found this tool helpful?'}
            </h4>
            <p className="text-xs text-gray-700 mb-3">
              {thanked
                ? 'That really makes my day. Good luck with your tax return!'
                : "It's free, open source and runs entirely in your browser. If it saved you time or an accountant's fee, a coffee (or a free GitHub star) would make my day."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={STRIPE_DONATION_LINK}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setPourCount((n) => n + 1)}
              className="inline-flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
            >
              Buy me a coffee
            </a>

            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setPourCount((n) => n + 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              Star on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
