import { useState } from 'react'
import { CoffeeCup } from './CoffeeCup'

const STRIPE_DONATION_LINK = 'https://buy.stripe.com/dRm8wRb1b2bQfarfaHeIw00'
const GITHUB_REPO_URL = 'https://github.com/coffee-cpu/capital-gains-uk-101'

// Where each coffee bean flies to when the coffee button is clicked
const BEANS = [
  { x: '-46px', y: '-34px', r: '-160deg' },
  { x: '-22px', y: '-50px', r: '120deg' },
  { x: '6px', y: '-56px', r: '-90deg' },
  { x: '30px', y: '-46px', r: '200deg' },
  { x: '52px', y: '-26px', r: '-140deg' },
  { x: '-58px', y: '-8px', r: '80deg' },
  { x: '62px', y: '-4px', r: '-60deg' },
]

function CoffeeBean({ x, y, r }: { x: string; y: string; r: string }) {
  return (
    <svg
      className="coffee-bean"
      viewBox="0 0 10 14"
      aria-hidden="true"
      style={{ '--bean-x': x, '--bean-y': y, '--bean-r': r } as React.CSSProperties}
    >
      <ellipse cx="5" cy="7" rx="4.5" ry="6.5" fill="#6f3d1f" />
      <path d="M5 1.5c-2 2-2 9 0 11" fill="none" stroke="#a8693d" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

// Two periods of a gentle wave per 100 units, drawn twice as wide as the
// button so sliding it by half its width loops seamlessly
const WAVE_TOP = 'M0 4 Q12.5 2 25 4 T50 4 T75 4 T100 4 T125 4 T150 4 T175 4 T200 4'

/**
 * Coffee sloshing inside the button: two slow wave layers with a crema line.
 * `slosh` plays a slosh by toggling a class, so the waves stay mounted and keep
 * their position (re-keying would restart them and make them jump).
 */
function ButtonCoffee({ slosh, onSloshEnd }: { slosh: boolean; onSloshEnd: () => void }) {
  return (
    <span
      className={`coffee-btn-liquid${slosh ? ' coffee-btn-slosh' : ''}`}
      aria-hidden="true"
      onAnimationEnd={(e) => {
        if (e.animationName === 'coffee-slosh') onSloshEnd()
      }}
    >
      <svg className="coffee-btn-wave coffee-btn-wave-back" viewBox="0 0 200 40" preserveAspectRatio="none">
        <path d={`${WAVE_TOP} V40 H0 Z`} fill="#8b5a2b" />
      </svg>
      <svg className="coffee-btn-wave coffee-btn-wave-front" viewBox="0 0 200 40" preserveAspectRatio="none">
        <path d={`${WAVE_TOP} V40 H0 Z`} fill="#6f3d1f" />
        <path d={WAVE_TOP} fill="none" stroke="#d9a066" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </span>
  )
}

/** Small cup icon shown inside the coffee button */
function ButtonCupIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 7c-1-1.5 1-2.5 0-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      <path d="M13 7c-1-1.5 1-2.5 0-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      <path d="M4 10h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-5Z" fill="currentColor" />
      <path d="M17 11.5h1.5a2.5 2.5 0 0 1 0 5H17" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

/**
 * BuyMeACoffee component
 *
 * A friendly, dismissible tip card. On the tax year summary it appears only
 * after the user has exported their PDF report, i.e. after they got value.
 * The animated cup loops through pour, steam, sip and refill; clicking either
 * button restarts it from the pour, and the coffee button also pops some beans.
 *
 * "Star on GitHub" is a secondary, free way to say thanks.
 *
 * Both are plain links: no third-party widget or script is loaded, so nothing
 * leaves the browser until the user clicks.
 */
export function BuyMeACoffee() {
  const [isDismissed, setIsDismissed] = useState(false)
  const [pourCount, setPourCount] = useState(0)
  const [beanBursts, setBeanBursts] = useState(0)
  const [sloshing, setSloshing] = useState(false)
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

      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
        {/* Re-keying the cup restarts its loop from the pour */}
        <CoffeeCup key={pourCount} className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0" />

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

          {/* Stacked at equal width on phones, side by side from sm up */}
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <span className="relative grid sm:inline-grid">
              <a
                href={STRIPE_DONATION_LINK}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setPourCount((n) => n + 1)
                  setBeanBursts((n) => n + 1)
                  setSloshing(true)
                }}
                className="coffee-btn inline-flex items-center justify-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-md"
              >
                <ButtonCoffee slosh={sloshing} onSloshEnd={() => setSloshing(false)} />
                <span className="relative inline-flex items-center gap-2">
                  <ButtonCupIcon />
                  Buy me a coffee
                </span>
              </a>
              {beanBursts > 0 && (
                <span key={beanBursts} aria-hidden="true">
                  {BEANS.map((bean, i) => (
                    <CoffeeBean key={i} {...bean} />
                  ))}
                </span>
              )}
            </span>

            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setPourCount((n) => n + 1)}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
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
