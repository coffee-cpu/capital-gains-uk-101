/**
 * HTML rendering for the static guide pages (built into dist/guides/ by the
 * Vite plugin in vite.config.ts). Plain strings, no React: the pages must be
 * readable without JavaScript by search engines and AI agents.
 */

export const SITE_URL = 'https://cgtvisualiser.co.uk'
export const SITE_NAME = 'Capital Gains Tax Visualiser'

export interface GuidePage {
  /** Absolute path with trailing slash, e.g. /guides/same-day-rule/ */
  path: string
  /** <title>, also used as the link text in guide lists */
  title: string
  /** Short name for breadcrumbs and lists */
  navTitle: string
  /** Meta description (aim for under 160 characters) */
  description: string
  h1: string
  /** Trusted HTML for the main content (escape any data with escapeHtml) */
  bodyHtml: string
  section: 'hub' | 'rules' | 'brokers'
  /** Extra schema.org objects (a BreadcrumbList is always added) */
  jsonLd?: object[]
  /** Paths of related guides listed at the end of the page */
  related?: string[]
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Format a GBP amount for guide text: 1234.5 → £1,234.50, -100 → (£100.00) */
export function gbp(value: number): string {
  const text = `£${Math.abs(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return value < 0 ? `(${text})` : text
}

/** JSON for a <script type="application/ld+json"> block; "<" is escaped so the text can't close the tag */
function jsonLdScript(data: object): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

const STYLES = `
:root{--brand:#11737d;--brand-dark:#0c5961;--ink:#0f172a;--text:#334155;--muted:#64748b;--line:#e2e8f0;--bg:#f8fafc}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--text);background:var(--bg);line-height:1.65;font-size:17px}
a{color:var(--brand)}a:hover{color:var(--brand-dark)}
header{background:#fff;border-bottom:1px solid var(--line)}
.bar{max-width:880px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);font-weight:700}
.logo img{width:36px;height:36px;border-radius:8px}
nav a{margin-left:18px;text-decoration:none;font-weight:600;font-size:15px}
nav .cta{background:var(--brand);color:#fff;padding:8px 14px;border-radius:8px}
nav .cta:hover{background:var(--brand-dark);color:#fff}
main{max-width:880px;margin:0 auto;padding:24px 20px 48px}
.crumbs{font-size:14px;color:var(--muted);margin-bottom:8px}
.crumbs a{color:var(--muted)}
h1{color:var(--ink);font-size:34px;line-height:1.2;margin:8px 0 16px}
h2{color:var(--ink);font-size:24px;margin:36px 0 12px}
h3{color:var(--ink);font-size:19px;margin:24px 0 8px}
.lead{font-size:19px;color:var(--text)}
article{background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px 28px 28px}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:15px;display:block;overflow-x:auto}
th,td{border-bottom:1px solid var(--line);padding:8px 10px;text-align:left;white-space:nowrap}
th{background:var(--bg);color:var(--ink)}
td.num,th.num{text-align:right}
.callout{border-radius:10px;padding:14px 18px;margin:18px 0}
.callout.info{background:#eff6ff;border:1px solid #bfdbfe}
.callout.warn{background:#fffbeb;border:1px solid #fde68a}
.callout.calc{background:#f0fdfa;border:1px solid #99f6e4}
.callout p{margin:6px 0}
.cta-box{background:var(--brand);color:#fff;border-radius:12px;padding:22px 24px;margin:32px 0 8px}
.cta-box h2{color:#fff;margin:0 0 6px;font-size:21px}
.cta-box p{margin:6px 0 14px}
.cta-box a.button{display:inline-block;background:#fff;color:var(--brand-dark);font-weight:700;padding:10px 16px;border-radius:8px;text-decoration:none}
code{background:#f1f5f9;padding:2px 6px;border-radius:5px;font-size:15px}
pre{background:#0f172a;color:#e2e8f0;padding:14px 16px;border-radius:10px;overflow-x:auto;font-size:14px}
pre code{background:none;padding:0;color:inherit}
ol li,ul li{margin:6px 0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;padding:0;list-style:none}
.cards li{margin:0}
.cards a{display:block;height:100%;background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px 16px;text-decoration:none}
.cards a:hover{border-color:var(--brand)}
.cards strong{display:block;color:var(--ink)}
.cards span{color:var(--muted);font-size:15px}
footer{max-width:880px;margin:0 auto;padding:0 20px 40px;color:var(--muted);font-size:14px}
@media (max-width:600px){h1{font-size:27px}article{padding:4px 18px 20px}nav a{margin-left:12px}}
`

export interface RenderContext {
  /** All pages, to resolve related links and breadcrumbs */
  pagesByPath: Map<string, GuidePage>
}

/** Render a complete, standalone HTML document for a guide page */
export function renderPage(page: GuidePage, context: RenderContext): string {
  const url = SITE_URL + page.path
  const crumbs: Array<{ name: string; path: string }> = [{ name: 'Guides', path: '/guides/' }]
  if (page.path !== '/guides/') crumbs.push({ name: page.navTitle, path: page.path })

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Calculator', item: SITE_URL + '/' },
      ...crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 2, name: c.name, item: SITE_URL + c.path })),
    ],
  }

  const related = (page.related ?? [])
    .map(path => context.pagesByPath.get(path))
    .filter((p): p is GuidePage => p !== undefined)

  const relatedHtml = related.length > 0
    ? `<h2>Related guides</h2><ul class="cards">${related.map(guideCard).join('')}</ul>`
    : ''

  const crumbHtml = page.path === '/guides/'
    ? `<a href="/">Calculator</a> › Guides`
    : `<a href="/">Calculator</a> › <a href="/guides/">Guides</a> › ${escapeHtml(page.navTitle)}`

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)}</title>
<meta name="description" content="${escapeHtml(page.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${escapeHtml(page.title)}">
<meta property="og:description" content="${escapeHtml(page.description)}">
<meta property="og:image" content="${SITE_URL}/og-image.png">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/favicon/favicon-96x96.png" sizes="96x96">
<link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg">
<link rel="alternate" type="text/markdown" href="/agents.md" title="Guide for AI agents">
<style>${STYLES.trim()}</style>
${jsonLdScript(breadcrumbLd)}
${(page.jsonLd ?? []).map(jsonLdScript).join('\n')}
</head>
<body>
<header><div class="bar">
<a class="logo" href="/"><img src="/favicon/apple-touch-icon.png" alt="" width="36" height="36">${SITE_NAME}</a>
<nav><a href="/guides/">Guides</a><a class="cta" href="/">Open the calculator</a></nav>
</div></header>
<main>
<div class="crumbs">${crumbHtml}</div>
<article>
<h1>${escapeHtml(page.h1)}</h1>
${page.bodyHtml}
<div class="cta-box">
<h2>Work it out from your own broker exports</h2>
<p>The free calculator applies the same-day, 30-day and Section 104 rules, converts foreign currency to GBP and adjusts for stock splits. It runs in your browser: your transactions are never uploaded.</p>
<a class="button" href="/">Open the calculator</a>
</div>
${relatedHtml}
</article>
</main>
<footer>
<p>These guides explain how the calculator applies HMRC's rules. They are not tax advice: check HMRC's guidance, such as <a href="https://www.gov.uk/government/publications/shares-and-capital-gains-tax-hs284-self-assessment-helpsheet">HS284 Shares and Capital Gains Tax</a>, or ask a qualified adviser before filing.</p>
<p><a href="/">Calculator</a> · <a href="/guides/">Guides</a> · <a href="/#about">About</a> · <a href="/agents.md">Guide for AI agents</a> · <a href="https://github.com/coffee-cpu/capital-gains-uk-101">Source code</a></p>
</footer>
</body>
</html>
`
}

export function guideCard(page: GuidePage): string {
  return `<li><a href="${page.path}"><strong>${escapeHtml(page.navTitle)}</strong><span>${escapeHtml(page.description)}</span></a></li>`
}
