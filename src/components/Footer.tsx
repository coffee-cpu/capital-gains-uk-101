const LINKS = [
  { label: 'Guides', href: '/guides/' },
  { label: 'About', href: '#about' },
  { label: 'Report an issue', href: 'https://github.com/coffee-cpu/capital-gains-uk-101/issues/new', external: true },
  { label: 'GitHub', href: 'https://github.com/coffee-cpu/capital-gains-uk-101', external: true },
]

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-gray-500">
        <p>Not financial or tax advice. Figures are estimates based on HMRC guidance.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
          {LINKS.map(link => (
            <a
              key={link.label}
              href={link.href}
              {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="text-gray-600 hover:text-brand-700 hover:underline"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
