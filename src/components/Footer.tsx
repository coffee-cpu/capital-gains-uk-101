import { freshnessItems } from '../lib/freshness'

const LINKS = [
  { label: 'Guides', href: '/guides/' },
  { label: 'About', href: '#about' },
  { label: 'Report an issue', href: 'https://github.com/coffee-cpu/capital-gains-uk-101/issues/new', external: true },
  { label: 'GitHub', href: 'https://github.com/coffee-cpu/capital-gains-uk-101', external: true },
]

export function Footer() {
  const items = freshnessItems(__BUILD_DATE__)
  return (
    <footer className="bg-white border-t border-gray-200">
      {/* Centred on phones; disclaimer left and links right on wider screens */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-3 text-center sm:text-left sm:flex-row sm:items-center sm:justify-between text-xs text-gray-500">
        <div className="flex flex-col gap-1">
          <p className="text-balance">Not financial or tax advice. Figures are estimates based on HMRC guidance.</p>
          {/* How up to date the calculator is; each item stays on one line */}
          <p data-testid="freshness" className="text-gray-400">
            {items.map((item, i) => (
              <span key={item.text}>
                {/* Below xl the last item goes on its own line, so no dot is left at a line end */}
                {i === items.length - 1 && <br className="xl:hidden" />}
                {i > 0 && (
                  <span aria-hidden="true" className={i === items.length - 1 ? 'hidden xl:inline' : undefined}> · </span>
                )}
                <span className="whitespace-nowrap">
                  {item.text}
                  {item.date && ' '}
                  {item.date &&
                    (item.href ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="See what the check covered"
                        className="underline decoration-gray-300 underline-offset-2 hover:text-brand-700 hover:decoration-current"
                      >
                        {item.date}
                      </a>
                    ) : (
                      item.date
                    ))}
                </span>
              </span>
            ))}
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap justify-center sm:justify-end gap-y-1">
          {LINKS.map((link, i) => (
            <span key={link.label} className="flex items-center">
              {i > 0 && <span aria-hidden="true" className="mx-2 text-gray-300">·</span>}
              <a
                href={link.href}
                {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="font-medium text-gray-700 hover:text-brand-700 hover:underline"
              >
                {link.label}
              </a>
            </span>
          ))}
        </nav>
      </div>
    </footer>
  )
}
