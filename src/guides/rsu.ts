import { GuidePage } from './html'
import { WORKED_EXAMPLES, renderResultTable, renderTransactionsTable } from './examples'
import { FOREIGN_CURRENCY_PATH, OVERVIEW_PATH, SAME_DAY_PATH, SECTION_104_PATH, THIRTY_DAY_PATH } from './rules'

/**
 * Guide to RSUs held at Charles Schwab. The worked example's figures come from
 * examples.ts (checked against the engine in tests). HMRC references checked
 * against GOV.UK in November 2026.
 */

const HS284 = 'https://www.gov.uk/government/publications/shares-and-capital-gains-tax-hs284-self-assessment-helpsheet'
const HS287 = 'https://www.gov.uk/government/publications/employee-share-and-security-schemes-and-capital-gains-tax-hs287-self-assessment-helpsheet'
const ERSM140095 = 'https://www.gov.uk/hmrc-internal-manuals/employment-related-securities/ersm140095'

export const SCHWAB_RSU_PATH = '/guides/schwab-rsu-capital-gains-tax/'

const title = 'Schwab RSUs and UK Capital Gains Tax: vests, shares withheld for tax and the 30-day rule'
const description = 'RSU vests from Schwab are acquisitions at market value. Which files to export, your cost per share, shares withheld for tax, and the 30-day rule trap.'

export const SCHWAB_RSU_GUIDE: GuidePage = {
  path: SCHWAB_RSU_PATH,
  title,
  navTitle: 'Schwab RSUs',
  description,
  h1: 'RSUs at Charles Schwab: UK Capital Gains Tax',
  bodyHtml: `
<p class="lead">When restricted stock units (RSUs) vest, you pay Income Tax and National Insurance on their value through payroll. For Capital Gains Tax, each vest is an <strong>acquisition of shares at their market value on the vest date</strong>. When you later sell, only the change in value since the vest is a capital gain or loss.</p>

<h2>Which files to export from Schwab</h2>
<p>You need two exports, and both should cover your whole history, back to your first vest:</p>
<ol>
<li><strong>Equity Award Center history.</strong> On schwab.com go to Accounts → Transaction History, choose “Other Accounts” → “Equity Award Center”, and export to CSV. This has every vest, with the market value per share and the number of shares you received.</li>
<li><strong>Brokerage account history.</strong> In Transaction History, choose your brokerage account (for example “Individual”) and export to CSV. This has your sales, dividends and anything you bought yourself.</li>
</ol>
<ul>
<li>Schwab lets you export at most 4 years at a time. For a longer history, export several periods. Overlapping periods are fine: the calculator counts rows that appear in two files once.</li>
<li>Include at least 30 days after the end of the tax year (to 5 May), so that a vest just after a sale near 5 April is matched with it (see <a href="#thirty-day">below</a>).</li>
<li>Vests also appear in the brokerage file as “Stock Plan Activity”, without a price. When you load both files, the calculator uses the Equity Award Center entry and doesn’t count the vest twice.</li>
</ul>

<h2>The cost of your shares</h2>
<p>The allowable cost of shares from a vest is their market value on the vest date (the “FairMarketValuePrice” in the Equity Award Center file) times the number of shares you received. That’s the value you’ve already paid Income Tax on, so it isn’t taxed again. All your shares of the company go into one <a href="${SECTION_104_PATH}">Section 104 pool</a> at their average cost, together with any you bought yourself.</p>
<ul>
<li>The market value is in US dollars. Convert each vest at the exchange rate for its date, and each sale at the rate for the sale date (see <a href="${FOREIGN_CURRENCY_PATH}">foreign currency shares</a>).</li>
<li>Don’t use the cost basis or the realised gain and loss report in your Schwab account. They follow US rules: in dollars, for specific lots. UK rules pool your shares and work in pounds, so the figures differ.</li>
</ul>

<h2>Shares withheld for tax</h2>
<p>The Equity Award Center file shows, for each vest, the shares withheld for tax (“SharesSoldWithheldForTaxes”) and the shares you received (“NetSharesDeposited”). How they count depends on how your employer pays the tax:</p>
<ul>
<li><strong>Net settlement</strong>: your employer keeps some of the shares and pays the tax in cash itself. You never own the shares withheld, so there’s nothing to sell and no capital gain on them (HMRC’s manual describes this at <a href="${ERSM140095}">ERSM140095</a>). Only the shares you received are an acquisition.</li>
<li><strong>Sell to cover</strong>: you receive all the shares and some are sold for you on the vest date to pay the tax. That sale is a disposal. It’s matched with the same day’s vest under the <a href="${SAME_DAY_PATH}">same-day rule</a>, so the gain or loss is just the difference between the sale price and the vest price, less fees, and is usually small.</li>
</ul>
<p>If you’re not sure which applies, ask your employer’s share plan team.</p>

<h2 id="thirty-day">Watch out: a vest just after a sale</h2>
<p>A vest is an acquisition like any purchase, so the <a href="${THIRTY_DAY_PATH}">30-day rule</a> applies to it. If you sell shares and more vest in the next 30 days, the sale is matched with the new vest first, at its market value, not with your pool. With regular vests this happens often, and it changes the gain.</p>
<p>In this example you hold 80 ACME shares from two earlier vests, at an average cost of £450. You sell 60 on 10 March 2025, and 20 more vest a week later. (Prices are shown in pounds to keep it simple.)</p>
${renderTransactionsTable(WORKED_EXAMPLES.rsu)}
<p>The first 20 shares sold are matched with the 17 March vest at £580 each. Only the other 40 come from the pool, at £450 each. The 20 shares that vested don’t go into the pool, because they were used by the sale.</p>
${renderResultTable(WORKED_EXAMPLES.rsu)}
<p>Using the pool for all 60 shares would give a cost of £27,000 and a gain of £9,000, so the 30-day rule changes this gain by £2,600.</p>

<h2>Calculate it</h2>
<p>Load both Schwab files, and any other broker’s exports, into the <a href="/">calculator</a>. It reads the Schwab formats automatically, converts each transaction to pounds, applies the same-day, 30-day and Section 104 rules, and shows which vest or pool each sale was matched with. Your files never leave your browser. The <a href="/guides/charles-schwab-equity-awards-capital-gains-tax/">Equity Awards</a> and <a href="/guides/charles-schwab-capital-gains-tax/">Charles Schwab</a> guides have more on each export.</p>
<p>From the command line, or with an AI agent such as Claude Code or Codex, pass all the files in one call:</p>
<pre><code>npx -y cgt-visualiser@latest calculate EquityAwardsCenter_Transactions_*.csv Individual_*_Transactions_*.csv --tax-year 2025/26</code></pre>

<h2>Dividends on your shares</h2>
<p>Dividends on shares from vests are income, not capital gains. US dividends usually have 15% US tax withheld, and go on the foreign income pages of your return. The calculator lists them separately.</p>

<div class="callout info"><p>This guide assumes you were UK resident while your RSUs vested. HMRC references: helpsheets <a href="${HS287}">HS287 Capital Gains Tax and employee share schemes</a> and <a href="${HS284}">HS284 Shares and Capital Gains Tax</a>.</p></div>
`,
  section: 'rules',
  jsonLd: [{
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url: 'https://cgtvisualiser.co.uk' + SCHWAB_RSU_PATH,
    inLanguage: 'en-GB',
    isAccessibleForFree: true,
    publisher: { '@type': 'Organization', name: 'Capital Gains Tax Visualiser', url: 'https://cgtvisualiser.co.uk/' },
  }],
  related: [THIRTY_DAY_PATH, SECTION_104_PATH, FOREIGN_CURRENCY_PATH, OVERVIEW_PATH],
}
