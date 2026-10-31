import { getEnabledBrokerDefinitions } from '../config/brokers'
import { BrokerDefinition } from '../types/brokerDefinition'
import { BrokerType } from '../types/broker'
import { GuidePage, escapeHtml } from './html'
import { OVERVIEW_PATH, SAME_DAY_PATH, SECTION_104_PATH, THIRTY_DAY_PATH, FOREIGN_CURRENCY_PATH, STOCK_SPLITS_PATH } from './rules'

/**
 * One guide per supported broker, generated from its BrokerDefinition, so the
 * export instructions match the ones in the app.
 */

const CRYPTO_BROKERS = new Set<BrokerType>([BrokerType.COINBASE, BrokerType.COINBASE_PRO])
/** Brokers whose statements are in pounds by default (others are mostly in US dollars) */
const GBP_BROKERS = new Set<BrokerType>([BrokerType.TRADING212, BrokerType.FREETRADE])
/** Employee share plans: shares are acquired by vesting, often sold the same day */
const EMPLOYEE_PLAN_BROKERS = new Set<BrokerType>([BrokerType.SCHWAB_EQUITY_AWARDS, BrokerType.EQUATE_PLUS])

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function brokerGuidePath(definition: BrokerDefinition): string {
  if (definition.type === BrokerType.GENERIC) return '/guides/generic-csv-format/'
  return `/guides/${slugify(definition.displayName)}-capital-gains-tax/`
}

function list(items: string[], ordered: boolean): string {
  const tag = ordered ? 'ol' : 'ul'
  return `<${tag}>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`
}

function exportSection(definition: BrokerDefinition): string {
  const { instructions, helpLinks } = definition
  const parts: string[] = []
  if (instructions.steps.length > 0) parts.push(list(instructions.steps, true))
  if (instructions.notes && instructions.notes.length > 0) parts.push(list(instructions.notes, false))
  if (instructions.info) parts.push(`<div class="callout info"><p>${escapeHtml(instructions.info)}</p></div>`)
  if (instructions.warning) parts.push(`<div class="callout warn"><p>${escapeHtml(instructions.warning)}</p></div>`)
  if (helpLinks && helpLinks.length > 0) {
    parts.push(`<p>${helpLinks.map(link => `<a href="${escapeHtml(link.url)}" rel="nofollow noopener">${escapeHtml(link.label)}</a>`).join(' · ')}</p>`)
  }
  return parts.join('\n')
}

function cliSection(): string {
  return `<h2>From the command line or an AI agent</h2>
<p>The same calculation engine is available as a command-line tool, which AI agents such as Claude Code and Codex can run for you. It works on your machine, like the website.</p>
<pre><code>npx -y cgt-visualiser@latest calculate your-export.csv --tax-year 2025/26</code></pre>
<p>Add <code>--format pdf -o report.pdf</code> for the same PDF report as the website. Agents can follow the <a href="/agents.md">agent guide</a>.</p>`
}

function brokerPage(definition: BrokerDefinition): GuidePage {
  const name = definition.displayName
  const path = brokerGuidePath(definition)
  const isCrypto = CRYPTO_BROKERS.has(definition.type)
  const assets = isCrypto ? 'crypto' : 'shares'

  const howToLd = definition.instructions.steps.length > 0
    ? [{
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: `How to export your ${name} transactions for UK Capital Gains Tax`,
        step: definition.instructions.steps.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
      }]
    : []

  const currencyText = GBP_BROKERS.has(definition.type)
    ? `Trades in other currencies are converted to pounds at the exchange rate for each transaction (see <a href="${FOREIGN_CURRENCY_PATH}">foreign currency shares</a>).`
    : `Amounts in US dollars or other currencies are converted to pounds at the exchange rate for each transaction, which matters for the gain (see <a href="${FOREIGN_CURRENCY_PATH}">foreign currency shares</a>).`

  const employeeText = EMPLOYEE_PLAN_BROKERS.has(definition.type)
    ? `<p>With an employee share plan, each vest is an acquisition at the shares’ market value on that day. Shares sold the same day they vest (for example “sell to cover”) are matched with that day’s vest under the <a href="${SAME_DAY_PATH}">same-day rule</a>, so the gain on them is usually small.</p>`
    : ''

  const cryptoText = isCrypto
    ? `<p>HMRC treats cryptoassets like shares for Capital Gains Tax: each token is pooled at its average cost, with the same-day and 30-day rules applied first.</p>`
    : ''

  const bodyHtml = `
<p class="lead">To work out UK Capital Gains Tax on your ${escapeHtml(name)} ${assets}, export your transaction history as a CSV file and load it into the free calculator. It recognises the ${escapeHtml(name)} format automatically and applies HMRC’s matching rules for you.</p>

<h2>Export your transactions from ${escapeHtml(name)}</h2>
${exportSection(definition)}
<p>Export your full history, back to your first purchase, not just the tax year you’re reporting. Sales are matched with purchases from earlier years.</p>

<h2>What the calculator does with the file</h2>
<ul>
<li>Reads each buy, sell${isCrypto ? '' : ', dividend'} and fee from the ${escapeHtml(name)} export. You can load several files at once, from different years or other brokers.</li>
<li>Matches each sale with your purchases using the <a href="${SAME_DAY_PATH}">same-day rule</a>, the <a href="${THIRTY_DAY_PATH}">30-day rule</a> and the <a href="${SECTION_104_PATH}">Section 104 pool</a>.</li>
<li>${currencyText}</li>
<li>Adjusts for <a href="${STOCK_SPLITS_PATH}">stock splits</a>.</li>
<li>Shows the gain or loss on every sale, the totals for each tax year, and the figures for your Self Assessment return. You can export them as a PDF.</li>
</ul>
${employeeText}${cryptoText}
<p>Everything runs in your browser. Your file is never uploaded. Want to see it first? Load the <a href="${escapeHtml(definition.exampleFile)}">example ${escapeHtml(name)} file</a>.</p>

${cliSection()}
`

  return {
    path,
    title: `${name} Capital Gains Tax: export your transactions and calculate UK CGT`,
    navTitle: name,
    description: `How to export your ${name} history and work out UK Capital Gains Tax with HMRC’s same-day, 30-day and Section 104 rules. Free and private.`,
    h1: `${name}: calculate UK Capital Gains Tax`,
    bodyHtml,
    section: 'brokers',
    jsonLd: howToLd,
    related: [OVERVIEW_PATH, SECTION_104_PATH, THIRTY_DAY_PATH],
  }
}

function genericPage(definition: BrokerDefinition): GuidePage {
  return {
    path: brokerGuidePath(definition),
    title: 'Generic CSV format for UK Capital Gains Tax: columns and examples',
    navTitle: 'Generic CSV (any broker)',
    description: 'Broker not supported? Put your transactions in a simple CSV with date, type, symbol, currency, quantity and price, and calculate UK CGT with HMRC’s rules.',
    h1: 'Generic CSV: calculate CGT for any broker',
    bodyHtml: `
<p class="lead">If your broker isn’t supported yet, or you want to add transactions by hand (for example shares transferred in from another broker), put them in a Generic CSV file. The calculator reads it like any broker export.</p>

<h2>Columns</h2>
${list(definition.instructions.notes ?? [], false)}
<p>Dates must be in <code>YYYY-MM-DD</code> format. Each row is one transaction:</p>
<pre><code>date,type,symbol,currency,quantity,price,total,fee
2024-01-15,BUY,VOD,GBP,1000,0.70,700,5
2024-09-02,SELL,VOD,GBP,1000,0.75,750,5</code></pre>
${definition.instructions.info ? `<div class="callout info"><p>${escapeHtml(definition.instructions.info)}</p></div>` : ''}
<p>Download the <a href="${escapeHtml(definition.exampleFile)}">example Generic CSV</a> to start from.</p>

<h2>Check that every row was read</h2>
<p>Rows with a missing date or an unrecognised type are left out, and the calculator lists them with their row numbers. A mistyped <code>SELL</code> would leave out a sale and make your gain look smaller, so fix any listed rows before using the totals.</p>

${cliSection()}
<p>The command-line tool can also convert broker exports into a Generic CSV you can edit: <code>npx -y cgt-visualiser@latest normalize export.csv -o transactions.csv</code>.</p>
`,
    section: 'brokers',
    related: [OVERVIEW_PATH, STOCK_SPLITS_PATH, SECTION_104_PATH],
  }
}

export function buildBrokerGuides(): GuidePage[] {
  return getEnabledBrokerDefinitions().map(definition =>
    definition.type === BrokerType.GENERIC ? genericPage(definition) : brokerPage(definition)
  )
}
