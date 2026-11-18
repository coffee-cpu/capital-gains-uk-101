import { GuidePage } from './html'
import { getDividendAllowance, getDividendTaxRates } from '../lib/cgt/allowances'
import { getSa100ForeignDividendsLimit } from '../lib/cgt/reporting'
import { FOREIGN_CURRENCY_PATH, OVERVIEW_PATH } from './rules'
import { SCHWAB_RSU_PATH } from './rsu'

/**
 * Guide to dividends and broker interest from a share account. The app lists
 * them next to capital gains but doesn't calculate the tax on them, because
 * that depends on the rest of a person's income.
 *
 * Checked against GOV.UK in November 2026:
 * - Dividend allowance and rates by year: in lib/cgt/allowances.ts, from
 *   "Income Tax rates and allowances for current and past years"
 * - Reporting dividends: "Tax on dividends: how to report tax on dividends"
 * - Savings interest: "Tax on savings interest" (how much is tax free, how
 *   you pay)
 * - Foreign dividends: SA106 Foreign notes 2024-25 and 2025-26 ("Check the
 *   Dividend Article of the relevant DTA", foreign tax is "the lower of the
 *   foreign tax actually withheld and the amount of tax credit allowed under
 *   the terms of a DTA"), "Tax on foreign income: if you're taxed twice", HS263
 * - Small foreign dividends on the main return: SA100 2024, 2025 and 2026 box 6
 *   ("Foreign dividends (up to £...)"), SA150 notes 2026 box 6
 */

const TAX_ON_DIVIDENDS = 'https://www.gov.uk/tax-on-dividends'
const REPORT_DIVIDENDS = 'https://www.gov.uk/tax-on-dividends/how-to-report-tax-on-dividends'
const TAXED_TWICE = 'https://www.gov.uk/tax-foreign-income/taxed-twice'
const HS263 = 'https://www.gov.uk/government/publications/calculating-foreign-tax-credit-relief-on-income-hs263-self-assessment-helpsheet'
const SA106 = 'https://www.gov.uk/government/publications/self-assessment-foreign-sa106'
const SA100 = 'https://www.gov.uk/government/publications/self-assessment-tax-return-sa100'
const SAVINGS_TAX_FREE = 'https://www.gov.uk/apply-tax-free-interest-on-savings/how-much-is-tax-free'
const SAVINGS_HOW_TO_PAY = 'https://www.gov.uk/apply-tax-free-interest-on-savings/how-you-pay-tax-on-savings-interest'
const W8BEN = 'https://www.irs.gov/forms-pubs/about-form-w-8-ben'

export const DIVIDENDS_PATH = '/guides/dividend-tax-foreign-shares/'

/** Tax years shown in the rates table */
const RATE_TABLE_YEARS = ['2023/24', '2024/25', '2025/26', '2026/27']

/** Whole pounds, e.g. £1,000 */
function pounds(amount: number): string {
  return `£${amount.toLocaleString('en-GB')}`
}

function ratesTable(): string {
  const rows = RATE_TABLE_YEARS.map(taxYear => {
    const rates = getDividendTaxRates(taxYear)!
    return `<tr><td>${taxYear}</td><td class="num">${pounds(getDividendAllowance(taxYear))}</td>` +
      `<td class="num">${rates.basic}%</td><td class="num">${rates.higher}%</td><td class="num">${rates.additional}%</td></tr>`
  })
  return `<table><thead><tr><th>Tax year</th><th class="num">Dividend allowance</th><th class="num">Basic rate</th><th class="num">Higher rate</th><th class="num">Additional rate</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
}

const title = 'Dividend tax on foreign shares: allowance, US withholding tax and SA106'
const description = 'How UK tax works on dividends from US and other foreign shares: the dividend allowance, 15% US withholding, Foreign Tax Credit Relief, and broker interest.'

export const DIVIDENDS_GUIDE: GuidePage = {
  path: DIVIDENDS_PATH,
  title,
  navTitle: 'Dividends and interest',
  description,
  h1: 'Dividends and interest from your share account',
  bodyHtml: `
<p class="lead">Dividends and cash interest from a share account are <strong>income</strong>, not capital gains. They’re taxed under Income Tax rules, with their own allowances, and they don’t change your Capital Gains Tax. Dividends from foreign shares usually have tax taken off abroad before you receive them, which you may be able to set against your UK tax.</p>

<h2>The dividend allowance and rates</h2>
<p>Dividends within your unused Personal Allowance aren’t taxed. On top of that, the first part of your dividends each year is covered by the dividend allowance. Dividends above both are taxed at the dividend rates for your Income Tax band:</p>
${ratesTable()}
<p>The allowance was ${pounds(getDividendAllowance('2022/23'))} up to 2022/23. Which band your dividends fall in depends on your other income, so the calculator doesn’t work out the tax: it shows your dividends for each tax year and the allowance that applies.</p>

<h2>Do you need to tell HMRC?</h2>
<ul>
<li><strong>Within the dividend allowance:</strong> you don’t need to tell HMRC.</li>
<li><strong>Above the allowance, up to £10,000:</strong> if you send a Self Assessment return, put them on it. If you don’t, tell HMRC between the end of the tax year (5 April) and 5 October: you can ask HMRC to change your tax code so the tax comes out of your wages or pension, or contact the helpline.</li>
<li><strong>Over £10,000:</strong> you need to send a Self Assessment return. If you don’t usually send one, register by 5 October after the end of the tax year.</li>
</ul>
<p>If you send a return, HMRC’s notes ask you to include all your dividends, even those within the allowance: they can affect the rate on the rest.</p>

<h2 id="foreign-dividends">Dividends from foreign shares</h2>
<p>Dividends from companies outside the UK, including US shares and funds domiciled abroad (such as Irish-domiciled ETFs), are foreign income. They go on the ‘Foreign’ pages of your return (<a href="${SA106}">SA106</a>), in pounds, country by country, with the amount before foreign tax and the foreign tax taken off.</p>
<h3 id="small-foreign-dividends">Small amounts: the main return instead</h3>
<p>If all your dividends for the year, UK and foreign, are within a small limit, you can put the foreign ones in box 6 of the main return (<a href="${SA100}">SA100</a>) instead of the Foreign pages: the amount you received in pounds, with the foreign tax taken off in box 7. The limit was ${pounds(getSa100ForeignDividendsLimit('2023/24')!)} for 2023/24, and is ${pounds(getSa100ForeignDividendsLimit('2025/26')!)} for 2024/25 and 2025/26. HMRC’s notes allow it only if your other foreign income is untaxed interest of up to £2,000, which goes in box 3. To claim Foreign Tax Credit Relief, use the Foreign pages.</p>
<p>Some funds hold mostly bonds. HMRC’s SA106 notes say that if an offshore fund has more than 60% invested in interest-bearing assets, its distributions are treated as interest, not dividends.</p>

<h2 id="us-withholding">US withholding tax and the W-8BEN form</h2>
<p>US companies take US tax off dividends paid to people outside the US. The UK–US tax treaty limits it to 15% for most shareholders, but only if your broker has a <a href="${W8BEN}">W-8BEN form</a> from you. Without one, the US takes 30%. Brokers such as Schwab, Interactive Brokers and Trading 212 ask for the form when you open the account, and it needs renewing every few years.</p>

<h2 id="ftcr">Foreign Tax Credit Relief</h2>
<p>You can usually claim <a href="${TAXED_TWICE}">Foreign Tax Credit Relief</a> on your Self Assessment return, so the same dividend isn’t fully taxed twice. Two limits apply:</p>
<ul>
<li><strong>The treaty rate.</strong> The foreign tax you claim for is the lower of the tax actually taken off and the rate the tax treaty allows. For US dividends that’s 15%. If 30% was taken because there was no W-8BEN, the extra 15% isn’t relieved in the UK; you’d have to reclaim it from the US.</li>
<li><strong>The UK tax on that dividend.</strong> The relief can’t be more than the UK tax due on the same income. If no UK tax is due on it, for example because it’s covered by your allowances, the foreign tax isn’t refunded.</li>
</ul>
<p>HMRC’s SA106 notes list countries whose taxed dividends get no relief at all, including Cyprus, Malta, Singapore, Jersey, Guernsey and the Isle of Man. HMRC’s helpsheet <a href="${HS263}">HS263</a> explains how the relief is worked out.</p>

<h3>Example</h3>
<p>A US company pays you a dividend worth £200 in pounds on the payment date. With a W-8BEN, 15% (£30) is taken off and you receive £170.</p>
<ul>
<li>The UK taxes the <strong>gross</strong> £200, not the £170 you received.</li>
<li>On SA106 you show £200 of dividends from the United States and £30 of foreign tax.</li>
<li>Foreign Tax Credit Relief can reduce the UK tax on that dividend by up to £30.</li>
</ul>
<p>Each dividend is converted at the exchange rate for its own date, like each share trade (see <a href="${FOREIGN_CURRENCY_PATH}">foreign currency shares</a>).</p>

<h2 id="interest">Cash interest from your broker</h2>
<p>Interest your broker pays on uninvested cash is savings income. Part of it can be tax free:</p>
<ul>
<li><strong>Personal Savings Allowance:</strong> <a href="${SAVINGS_TAX_FREE}">£1,000 a year for basic rate taxpayers, £500 for higher rate, and nothing for additional rate</a>.</li>
<li><strong>Starting rate for savings:</strong> up to £5,000 of interest can be tax free if your other income is low. Every £1 of other income above your Personal Allowance reduces it by £1.</li>
</ul>
<p>Above those, <a href="${SAVINGS_HOW_TO_PAY}">HMRC usually collects the tax through your tax code</a>, or by a Simple Assessment letter. If you send a Self Assessment return, put the interest on it. If your interest is more than £10,000, you have to report it on a return. Interest from a broker outside the UK is foreign income and goes on the Foreign pages, like foreign dividends.</p>

<h2>What the calculator shows</h2>
<p>The <a href="/">calculator</a> reads dividends and interest from your broker exports, with any tax taken off where the export shows it, and converts each one to pounds. For each tax year it shows:</p>
<ul>
<li>gross dividends, tax withheld abroad and the amount received, for the SA106 pages</li>
<li>the dividend allowance for the year, and whether your dividends are above it</li>
<li>interest received and any tax taken off</li>
</ul>
<p>These figures are separate from your capital gains: they don’t change your Capital Gains Tax. The PDF report lists dividends by holding. Your files never leave your browser. For capital gains on the same shares, see the <a href="${OVERVIEW_PATH}">overview of HMRC’s share rules</a>, or for Schwab RSUs, the <a href="${SCHWAB_RSU_PATH}">RSU guide</a>.</p>

<div class="callout info"><p>This guide assumes you’re UK resident and not using the remittance basis. HMRC references: <a href="${TAX_ON_DIVIDENDS}">Tax on dividends</a>, <a href="${REPORT_DIVIDENDS}">how to report tax on dividends</a>, the SA106 Foreign notes and helpsheet HS263.</p></div>
`,
  section: 'rules',
  jsonLd: [{
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url: 'https://cgtvisualiser.co.uk' + DIVIDENDS_PATH,
    inLanguage: 'en-GB',
    isAccessibleForFree: true,
    publisher: { '@type': 'Organization', name: 'Capital Gains Tax Visualiser', url: 'https://cgtvisualiser.co.uk/' },
  }],
  related: [FOREIGN_CURRENCY_PATH, SCHWAB_RSU_PATH, OVERVIEW_PATH],
}
