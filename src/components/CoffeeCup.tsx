import { useId } from 'react'

const CUP_INSIDE = 'M17 27h28l-3.2 22.5a4 4 0 0 1-4 3.5H24.2a4 4 0 0 1-4-3.5Z'

/**
 * Animated coffee cup used by the BuyMeACoffee card.
 *
 * Plays a slow loop: coffee pours in, steams for a while, is sipped (the cup
 * tilts and the level drops), then the empty cup is refilled. Change the `key`
 * to restart the loop from the pour. All animation is CSS (see the `coffee-*`
 * rules in index.css); under `prefers-reduced-motion` the cup is shown full and still.
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
        {/* Inside of the cup, used to clip the coffee */}
        <clipPath id={clipId}>
          <path d={CUP_INSIDE} />
        </clipPath>
      </defs>

      {/* Saucer stays put while the cup is sipped */}
      <ellipse cx="31" cy="57" rx="20" ry="3" fill="#e7d3bd" />

      {/* Steam, shown only while the cup is full */}
      <g className="coffee-steam-group" fill="none" stroke="#d6b89a" strokeWidth="2" strokeLinecap="round">
        <path className="coffee-steam coffee-steam-1" d="M24 20c-2-3 2-5 0-8" />
        <path className="coffee-steam coffee-steam-2" d="M31 20c-2-3 2-5 0-8" />
        <path className="coffee-steam coffee-steam-3" d="M38 20c-2-3 2-5 0-8" />
      </g>

      <g className="coffee-mug">
        {/* Handle */}
        <path
          d="M44.5 32h3a5 5 0 0 1 0 10h-4.2"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Empty cup */}
        <path d={CUP_INSIDE} fill="#fff7ed" />

        {/* Coffee level */}
        <g clipPath={`url(#${clipId})`}>
          <g className="coffee-liquid">
            <rect x="10" y="30" width="44" height="30" fill="#6f3d1f" />
            <ellipse cx="31" cy="30" rx="15" ry="1.8" fill="#a8693d" />
          </g>
        </g>

        {/* Cup outline */}
        <path d={CUP_INSIDE} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinejoin="round" />
      </g>

      {/* Stream of coffee pouring in from above */}
      <line
        className="coffee-stream"
        x1="31"
        y1="0"
        x2="31"
        y2="48"
        stroke="#6f3d1f"
        strokeWidth="3"
        strokeLinecap="round"
        pathLength={100}
      />
    </svg>
  )
}
