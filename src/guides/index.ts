import { GuidePage, SITE_URL, guideCard, renderPage } from './html'
import { RULE_GUIDES } from './rules'
import { buildBrokerGuides } from './brokers'
import { SCHWAB_RSU_GUIDE } from './rsu'
import { DIVIDENDS_GUIDE } from './dividends'

export type { GuidePage } from './html'

export interface GuideSite {
  pages: GuidePage[]
  /** Output files: path relative to the site root → contents */
  files: Map<string, string>
}

function hubPage(rules: GuidePage[], employeeShares: GuidePage[], income: GuidePage[], brokers: GuidePage[]): GuidePage {
  return {
    path: '/guides/',
    title: 'UK Capital Gains Tax on shares: guides to HMRC’s rules and broker exports',
    navTitle: 'Guides',
    description: 'Free guides to UK tax on shares: the same-day, 30-day and Section 104 rules, stock splits, foreign currency, dividends, and how to export from each broker.',
    h1: 'Capital Gains Tax on shares: guides',
    bodyHtml: `
<p class="lead">How HMRC’s rules work for shares, and how to get the right file from your broker to calculate your gains.</p>
<h2>HMRC’s rules</h2>
<ul class="cards">${rules.map(guideCard).join('')}</ul>
<h2>Employee shares</h2>
<ul class="cards">${employeeShares.map(guideCard).join('')}</ul>
<h2>Dividends and interest</h2>
<ul class="cards">${income.map(guideCard).join('')}</ul>
<h2>Broker guides</h2>
<ul class="cards">${brokers.map(guideCard).join('')}</ul>
`,
    section: 'hub',
  }
}

/**
 * Sitemap for the calculator, the agent files and every guide. No lastmod:
 * a build date on every URL would claim changes that didn't happen.
 */
export function buildSitemap(pages: GuidePage[]): string {
  const urls = ['/', ...pages.map(p => p.path), '/agents.md', '/llms.txt']
  const entries = urls.map(path => `  <url><loc>${SITE_URL}${path}</loc></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`
}

/** Build every guide page and the sitemap */
export function buildGuideSite(): GuideSite {
  const rules = RULE_GUIDES
  const brokers = buildBrokerGuides()
  const employeeShares = [SCHWAB_RSU_GUIDE]
  const income = [DIVIDENDS_GUIDE]
  const pages = [hubPage(rules, employeeShares, income, brokers), ...rules, ...employeeShares, ...income, ...brokers]
  const pagesByPath = new Map(pages.map(p => [p.path, p]))

  const files = new Map<string, string>()
  for (const page of pages) {
    files.set(`${page.path.slice(1)}index.html`, renderPage(page, { pagesByPath }))
  }
  files.set('sitemap.xml', buildSitemap(pages))
  return { pages, files }
}
