import { GuidePage } from './html'
import { WORKED_EXAMPLES, renderResultTable, renderTransactionsTable } from './examples'

/**
 * Guides to HMRC's rules for shares. Figures in the worked examples come from
 * examples.ts (checked against the engine in tests); tax rates and allowances
 * were checked against GOV.UK in October 2026.
 */

const HS284 = 'https://www.gov.uk/government/publications/shares-and-capital-gains-tax-hs284-self-assessment-helpsheet'
const CG51560 = 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560'
const CG51620 = 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51620'
const CG78310 = 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg78310'
const RATES = 'https://www.gov.uk/government/publications/rates-and-allowances-capital-gains-tax/capital-gains-tax-rates-and-annual-tax-free-allowances'
const SA108_NOTES = 'https://www.gov.uk/government/publications/self-assessment-capital-gains-summary-sa108'

export const OVERVIEW_PATH = '/guides/how-to-calculate-capital-gains-tax-on-shares/'
export const SAME_DAY_PATH = '/guides/same-day-rule/'
export const THIRTY_DAY_PATH = '/guides/30-day-rule/'
export const SECTION_104_PATH = '/guides/section-104-pool/'
export const STOCK_SPLITS_PATH = '/guides/stock-splits/'
export const FOREIGN_CURRENCY_PATH = '/guides/foreign-currency-shares/'

const RULE_PATHS = [OVERVIEW_PATH, SAME_DAY_PATH, THIRTY_DAY_PATH, SECTION_104_PATH, STOCK_SPLITS_PATH, FOREIGN_CURRENCY_PATH]
const otherRules = (path: string) => RULE_PATHS.filter(p => p !== path)

function article(page: Pick<GuidePage, 'path' | 'title' | 'description'>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.title,
    description: page.description,
    url: 'https://cgtvisualiser.co.uk' + page.path,
    inLanguage: 'en-GB',
    isAccessibleForFree: true,
    publisher: { '@type': 'Organization', name: 'Capital Gains Tax Visualiser', url: 'https://cgtvisualiser.co.uk/' },
  }
}

function rulePage(page: Omit<GuidePage, 'section' | 'jsonLd' | 'related'> & { jsonLd?: object[] }): GuidePage {
  return {
    ...page,
    section: 'rules',
    jsonLd: [article(page), ...(page.jsonLd ?? [])],
    related: otherRules(page.path),
  }
}

const overview = rulePage({
  path: OVERVIEW_PATH,
  title: 'How to calculate Capital Gains Tax on shares in the UK (2025/26 and 2026/27)',
  navTitle: 'How to calculate CGT on shares',
  description: 'Step by step: match each sale using HMRC’s same-day, 30-day and Section 104 rules, work out the gain, deduct the £3,000 allowance and apply 18% or 24%.',
  h1: 'How to calculate Capital Gains Tax on shares',
  bodyHtml: `
<p class="lead">When you sell shares outside an ISA or pension for more than they cost, the profit is a capital gain. Working out the gain on each sale is the hard part, because HMRC decides <em>which</em> shares you sold using three matching rules, in a fixed order.</p>

<h2>1. Gather your complete transaction history</h2>
<p>You need every purchase and sale of each share, back to the first time you bought it, not just this tax year. Without earlier purchases, a sale can’t be matched to its cost. Include employee share plan vests (RSUs), stock splits and transfers between brokers. Leave out ISAs and pensions: gains inside them are free of Capital Gains Tax.</p>

<h2>2. Match each sale with the shares you bought</h2>
<p>HMRC matches the shares you sell with shares you acquired, in this order (<a href="${CG51560}">CG51560</a>):</p>
<ol>
<li><a href="${SAME_DAY_PATH}">Same-day rule</a>: shares bought on the same day as the sale.</li>
<li><a href="${THIRTY_DAY_PATH}">30-day rule</a>: shares bought in the 30 days <em>after</em> the sale (the “bed and breakfast” rule).</li>
<li><a href="${SECTION_104_PATH}">Section 104 pool</a>: everything else, at the average cost of all the shares you still hold.</li>
</ol>
<p>The calculator does this matching for you, and shows which rule matched each sale.</p>

<h2>3. Work out the gain or loss on each sale</h2>
<p>Gain = sale proceeds − allowable costs. Allowable costs are what you paid for the matched shares, including dealing fees and stamp duty. Fees on the sale are deducted from the proceeds. Amounts in other currencies are converted to pounds (see <a href="${FOREIGN_CURRENCY_PATH}">foreign currency shares</a>).</p>

<h2>4. Add up the year and deduct the allowance</h2>
<p>Add the year’s gains, subtract the year’s losses, and then deduct the annual exempt amount. Losses from earlier years can reduce the rest, if you reported them to HMRC (you have 4 years from the end of the tax year to claim a loss).</p>
<table>
<thead><tr><th>Tax year</th><th class="num">Annual exempt amount</th><th>Rates on shares</th></tr></thead>
<tbody>
<tr><td>2026/27</td><td class="num">£3,000</td><td>18% basic rate, 24% higher rate</td></tr>
<tr><td>2025/26</td><td class="num">£3,000</td><td>18% basic rate, 24% higher rate</td></tr>
<tr><td>2024/25</td><td class="num">£3,000</td><td>10% / 20% before 30 October 2024; 18% / 24% from 30 October 2024</td></tr>
<tr><td>2023/24</td><td class="num">£6,000</td><td>10% / 20%</td></tr>
<tr><td>2020/21 to 2022/23</td><td class="num">£12,300</td><td>10% / 20%</td></tr>
</tbody>
</table>
<p>Source: <a href="${RATES}">GOV.UK Capital Gains Tax rates and allowances</a>. Which rate applies depends on your taxable income: gains that fall within your unused basic rate band are taxed at the lower rate. For 2024/25, gains on sales from 30 October 2024 used the new rates, so the calculator splits that year’s gains around that date.</p>

<h2>5. Report it</h2>
<p>If you file a Self Assessment return, gains on shares go on the Capital Gains summary pages (<a href="${SA108_NOTES}">SA108</a>), in the “listed shares and securities” section. You may need to fill them in even when no tax is due, for example when your total sale proceeds are over £50,000. Check the SA108 notes for the year. If you don’t file Self Assessment, HMRC’s real time Capital Gains Tax service may be an option.</p>

<div class="callout info"><p><strong>Read more:</strong> HMRC’s helpsheet <a href="${HS284}">HS284 Shares and Capital Gains Tax</a> has the official rules and worked examples.</p></div>
`,
})

const sameDay = rulePage({
  path: SAME_DAY_PATH,
  title: 'The same-day rule for Capital Gains Tax on shares, with a worked example',
  navTitle: 'Same-day rule',
  description: 'Shares sold on the same day you bought shares of the same company are matched with those purchases first. How it works, with a worked example.',
  h1: 'The same-day rule',
  bodyHtml: `
<p class="lead">When you sell shares, HMRC first matches them with any shares of the same company you <strong>bought on the same day</strong>. Only the rest are matched using the 30-day rule and then the Section 104 pool.</p>

<h2>How it works</h2>
<ul>
<li>All your purchases of a share on one day are treated as a single purchase, and all your sales that day as a single sale (TCGA 1992 section 105(1)).</li>
<li>The day’s sale is matched with the day’s purchases first, up to the number of shares bought that day.</li>
<li>Any shares sold beyond that are matched under the <a href="${THIRTY_DAY_PATH}">30-day rule</a>, then from the <a href="${SECTION_104_PATH}">Section 104 pool</a>.</li>
<li>Shares bought that day but not used for the sale can still be matched with a sale in the previous 30 days under the 30-day rule. Any left over go into the Section 104 pool.</li>
</ul>
<p>This often matters for employees with RSUs that are sold on the day they vest (“sell to cover”): the sale is matched with the shares that vested that day.</p>

<h2>Worked example</h2>
<p>You already hold 100 ACME shares in your Section 104 pool. On 10 June 2025 you buy 50 more and sell 80.</p>
${renderTransactionsTable(WORKED_EXAMPLES.sameDay)}
<p>The 80 shares sold are matched with the 50 bought that day first (cost £700). The other 30 come from the pool at its average cost of £10 a share (£300).</p>
${renderResultTable(WORKED_EXAMPLES.sameDay)}

<div class="callout info"><p>HMRC reference: <a href="${CG51560}">CG51560</a> and helpsheet <a href="${HS284}">HS284</a>.</p></div>
`,
})

const thirtyDay = rulePage({
  path: THIRTY_DAY_PATH,
  title: 'The 30-day “bed and breakfast” rule for shares, with a worked example',
  navTitle: '30-day rule (bed and breakfasting)',
  description: 'If you buy back shares within 30 days after selling them, HMRC matches the sale with the new purchase. How the bed and breakfast rule works, with an example.',
  h1: 'The 30-day “bed and breakfast” rule',
  bodyHtml: `
<p class="lead">If you sell shares and buy shares of the same company again within the <strong>next 30 days</strong>, HMRC matches the sale with the new purchase instead of with the shares you already held. This stops people selling and immediately buying back just to create a gain or a loss for tax purposes (“bed and breakfasting”).</p>

<h2>How it works</h2>
<ul>
<li>It applies to shares bought in the 30 days <em>after</em> the sale, not before. Purchases before the sale go into the Section 104 pool.</li>
<li>It comes after the <a href="${SAME_DAY_PATH}">same-day rule</a> and before the <a href="${SECTION_104_PATH}">Section 104 pool</a> (TCGA 1992 section 106A(5)).</li>
<li>If there are several purchases in the 30 days, the earliest is matched first.</li>
<li>Buying back inside an ISA or pension is a different holding, so it isn’t matched with a sale outside it.</li>
</ul>

<h2>Worked example</h2>
<p>You bought 1,000 ACME shares for £5 each. ACME has fallen to £4, so you sell them all on 3 March 2025 to use the loss, then buy 1,000 back on 20 March 2025 for £4.10.</p>
${renderTransactionsTable(WORKED_EXAMPLES.thirtyDay)}
<p>Without the 30-day rule, the sale would show a £1,000 loss against the pool. Because you bought back within 30 days, the sale is matched with the new shares instead, so the loss is only £100. The original £5,000 cost stays in the Section 104 pool for the 1,000 shares you now hold.</p>
${renderResultTable(WORKED_EXAMPLES.thirtyDay)}

<div class="callout warn"><p>A 30-day purchase can fall in the next tax year, so a sale near 5 April can be matched with shares bought after the year ends. Include transactions after the year end when you calculate.</p></div>
<div class="callout info"><p>HMRC reference: <a href="${CG51560}">CG51560</a> and helpsheet <a href="${HS284}">HS284</a>.</p></div>
`,
})

const section104 = rulePage({
  path: SECTION_104_PATH,
  title: 'Section 104 pool: how average cost works for UK Capital Gains Tax on shares',
  navTitle: 'Section 104 pool',
  description: 'Shares of the same company are pooled at their average cost. How the Section 104 holding works, what goes in it, and a worked example of a sale from the pool.',
  h1: 'The Section 104 pool',
  bodyHtml: `
<p class="lead">For most sales, HMRC treats all the shares you hold in one company as a single “Section 104 holding” with one total cost. When you sell from it, the cost of the shares sold is their share of that total: in effect, the <strong>average cost</strong>.</p>

<h2>How it works</h2>
<ul>
<li>Each purchase adds its shares and its cost (including fees and stamp duty) to the pool, unless the shares are used by the <a href="${SAME_DAY_PATH}">same-day</a> or <a href="${THIRTY_DAY_PATH}">30-day</a> rules.</li>
<li>When you sell from the pool, the allowable cost is: total pool cost × shares sold ÷ shares in the pool.</li>
<li>The pool’s quantity and cost both go down by the shares sold and their cost, so the average cost of the rest doesn’t change.</li>
<li>Shares held in different accounts (for example two brokers) are in the same pool. ISA and pension holdings are not.</li>
<li>A <a href="${STOCK_SPLITS_PATH}">stock split</a> changes the number of shares in the pool but not its total cost.</li>
</ul>

<h2>Worked example</h2>
<p>You buy 100 ACME shares for £10 each, then 200 more for £13 each. The pool now holds 300 shares that cost £3,600, an average of £12 a share. You then sell 150.</p>
${renderTransactionsTable(WORKED_EXAMPLES.section104)}
<p>The cost of the 150 shares sold is £3,600 × 150 ÷ 300 = £1,800.</p>
${renderResultTable(WORKED_EXAMPLES.section104)}

<div class="callout info"><p>HMRC reference: <a href="${CG51620}">CG51620</a> and helpsheet <a href="${HS284}">HS284</a>.</p></div>
`,
})

const stockSplits = rulePage({
  path: STOCK_SPLITS_PATH,
  title: 'Stock splits and Capital Gains Tax: how a share split changes your cost per share',
  navTitle: 'Stock splits',
  description: 'A stock split isn’t a sale and doesn’t create a gain. Your total cost stays the same and is spread across the new number of shares. Worked example included.',
  h1: 'Stock splits and Capital Gains Tax',
  bodyHtml: `
<p class="lead">A stock split (for example 10 for 1) or a reverse split isn’t a disposal, so there’s no gain or loss when it happens. You hold more (or fewer) shares, but their <strong>total cost stays the same</strong>. HMRC treats the new shares as the same asset as the old ones (TCGA 1992 section 127).</p>

<h2>Why it matters</h2>
<p>Broker statements show your purchases in the share numbers before the split and your sales in the numbers after it. If you don’t adjust for the split, sales seem to have far more shares than you bought, and the cost per share is wrong. The calculator converts earlier quantities to post-split units before matching, and shows both the original and adjusted figures.</p>
<p>Splits often aren’t in broker exports. The calculator looks them up from a public list of stock splits, and you can add one yourself as a <code>STOCK_SPLIT</code> row in a <a href="/guides/generic-csv-format/">Generic CSV</a>.</p>

<h2>Worked example</h2>
<p>You buy 10 ACME shares for £1,000 each (£10,000). ACME later splits 10 for 1, so you hold 100 shares that still cost £10,000 in total (£100 each). You then sell 50 for £120 each.</p>
${renderTransactionsTable(WORKED_EXAMPLES.stockSplit)}
${renderResultTable(WORKED_EXAMPLES.stockSplit)}

<div class="callout info"><p>HMRC reference: helpsheet <a href="${HS284}">HS284</a>, which covers share reorganisations.</p></div>
`,
})

const foreignCurrency = rulePage({
  path: FOREIGN_CURRENCY_PATH,
  title: 'Capital Gains Tax on US and other foreign shares: converting to pounds',
  navTitle: 'Foreign currency shares',
  description: 'Gains on shares bought and sold in dollars or other currencies are worked out in pounds, converting each transaction separately. Which exchange rates you can use.',
  h1: 'Foreign currency shares: converting to pounds',
  bodyHtml: `
<p class="lead">If you buy and sell shares in US dollars or another currency, the gain is worked out in <strong>pounds</strong>. Convert the cost at the exchange rate when you bought and the proceeds at the rate when you sold. The gain is not the dollar gain converted at today’s rate.</p>

<h2>Why each transaction is converted separately</h2>
<p>Exchange rates move. If you buy shares for $10,000 when £1 = $1.25 (£8,000) and sell them for $10,000 when £1 = $1.30 (about £7,692), you have a loss of about £308 in pounds, even though the dollar price didn’t change. Currency movements are part of your gain or loss.</p>

<h2>Which exchange rate to use</h2>
<p>HMRC doesn’t prescribe a rate. Its manual says it expects “a reasonable and consistent method” (<a href="${CG78310}">CG78310</a>). The calculator offers three, and uses the same one for every transaction:</p>
<ul>
<li><strong>HMRC monthly rates</strong> (default): the rates HMRC publishes for each month.</li>
<li><strong>HMRC yearly average rates</strong>.</li>
<li><strong>Daily spot rates</strong>: European Central Bank reference rates for the day of each transaction.</li>
</ul>
<p>Pick one method and use it every year. Fees charged in another currency are converted the same way.</p>

<h2>Dividends and withholding tax</h2>
<p>Dividends from foreign shares are income, not capital gains, and go on the foreign income pages of your return. US dividends usually have 15% US tax withheld if you’ve filed a W-8BEN form. The calculator shows gross dividends and the tax withheld in pounds, to help with Foreign Tax Credit Relief.</p>
`,
})

export const RULE_GUIDES: GuidePage[] = [overview, sameDay, thirtyDay, section104, stockSplits, foreignCurrency]
