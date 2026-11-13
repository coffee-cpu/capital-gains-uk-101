import { useId } from 'react'

/**
 * Animated coffee cup used by the BuyMeACoffee card.
 *
 * On mount a stream of coffee pours into the cup, the level rises and steam
 * starts to rise. Change the `key` to replay the pour. All animation is CSS
 * (see the `coffee-*` rules in index.css) and is turned off under
 * `prefers-reduced-motion`, where the cup is shown full.
 */
export function CoffeeCup({ className = '' }: { className?: string }) {
  // useId can contain characters that break url(#...) references
  const clipId = `coffee-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg
      viewBox="0 0 64 64"
      className={`coffee-cup ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Inside of the cup, used to clip the rising coffee */}
        <clipPath id={clipId}>
          <path d="M17 27h28l-3.2 22.5a4 4 0 0 1-4 3.5H24.2a4 4 0 0 1-4-3.5Z" />
        </clipPath>
      </defs>

      {/* Steam */}
      <g className="coffee-steam-group" fill="none" stroke="#d6b89a" strokeWidth="2" strokeLinecap="round">
        <path className="coffee-steam coffee-steam-1" d="M24 20c-2-3 2-5 0-8" />
        <path className="coffee-steam coffee-steam-2" d="M31 20c-2-3 2-5 0-8" />
        <path className="coffee-steam coffee-steam-3" d="M38 20c-2-3 2-5 0-8" />
      </g>


      <g className="coffee-body">
        {/* Saucer */}
        <ellipse cx="31" cy="57" rx="20" ry="3" fill="#e7d3bd" />

        {/* Handle */}
        <path
          d="M44.5 32h3a5 5 0 0 1 0 10h-4.2"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Cup interior (empty) */}
        <path d="M17 27h28l-3.2 22.5a4 4 0 0 1-4 3.5H24.2a4 4 0 0 1-4-3.5Z" fill="#fff7ed" />

        {/* Stream of coffee pouring from above */}
        <line
          className="coffee-stream"
          x1="31"
          y1="0"
          x2="31"
          y2="50"
          stroke="#6f3d1f"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={100}
        />

        {/* Coffee, rising from the bottom */}
        <g clipPath={`url(#${clipId})`}>
          <g className="coffee-liquid">
            <rect x="10" y="30" width="44" height="30" fill="#6f3d1f" />
            <ellipse cx="31" cy="30" rx="15" ry="1.8" fill="#a8693d" />
          </g>
        </g>

        {/* Cup outline */}
        <path
          d="M17 27h28l-3.2 22.5a4 4 0 0 1-4 3.5H24.2a4 4 0 0 1-4-3.5Z"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
