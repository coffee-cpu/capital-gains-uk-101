import { GuidePage } from './html'
import { OVERVIEW_PATH } from './rules'
import { DIVIDENDS_PATH } from './dividends'

/**
 * Guide to UK gilts and Capital Gains Tax. The calculator doesn't calculate
 * bonds: Interactive Brokers bond trades are left out and listed as skipped
 * rows (see describeBondTrade in lib/parsers/interactiveBrokers.ts).
 *
 * Checked against GOV.UK in November 2026:
 * - "Capital Gains Tax: what you pay it on" lists UK government gilts among exempt gains
 * - CG54900: all disposals of gilt-edged securities since 2 July 1986 are exempt (TCGA92/S115)
 * - CG54224: gilts can't give rise to chargeable gains or allowable losses; gilt
 *   strips held by individuals are relevant discounted securities (income, not CGT)
 * - HS343 Accrued Income Scheme (2026): covers gilts; doesn't apply if the total
 *   nominal value held is not more than £5,000 at any time in the year or the year before
 */

const WHAT_YOU_PAY_IT_ON = 'https://www.gov.uk/capital-gains-tax/what-you-pay-it-on'
const CG54900 = 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg54900'
const CG54224 = 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg54224'
const GILT_LIST = 'https://www.gov.uk/guidance/gilt-edged-securities-exempt-from-capital-gains-tax'
const HS343 = 'https://www.gov.uk/government/publications/accrued-income-scheme-hs343-self-assessment-helpsheet'
const GENERIC_CSV_PATH = '/guides/generic-csv-format/'

export const GILTS_PATH = '/guides/gilts-capital-gains-tax/'

const title = 'UK gilts and Capital Gains Tax: why gains are exempt and losses don’t count'
const description = 'Gains on UK government gilts are free of Capital Gains Tax, and losses on them can’t be used. The interest is still taxable. What this means for your return.'

export const GILTS_GUIDE: GuidePage = {
  path: GILTS_PATH,
  title,
  navTitle: 'Gilts',
  updated: '2026-11-18',
  description,
  h1: 'UK gilts and Capital Gains Tax',
  bodyHtml: `
<p class="lead">Gilts are bonds issued by the UK government. <strong>Gains on them are exempt from Capital Gains Tax</strong>, whether you sell them or hold them until they’re repaid. The interest they pay is still taxed as income.</p>

<h2>No tax on the gain, no relief for a loss</h2>
<ul>
<li><strong>Gains are exempt.</strong> HMRC lists <a href="${WHAT_YOU_PAY_IT_ON}">UK government gilts</a> among the assets you don’t pay Capital Gains Tax on. All disposals of gilts since 2 July 1986 have been exempt (<a href="${CG54900}">CG54900</a>, TCGA 1992 section 115).</li>
<li><strong>Losses don’t count.</strong> Gilts can’t give rise to chargeable gains <em>or allowable losses</em> (<a href="${CG54224}">CG54224</a>). A loss on a gilt can’t be set against gains on shares.</li>
<li><strong>They don’t go on the capital gains pages.</strong> Gilt sales don’t count towards the annual exempt amount or the proceeds limit for reporting, and you leave them off SA108.</li>
</ul>
<p>Index-linked gilts are gilts too. HMRC publishes the <a href="${GILT_LIST}">list of gilt-edged securities</a> the exemption covers. Gilt strips are different: if you hold them as an individual, the profit is taxed as income, not as a capital gain.</p>

<h2>Other bonds</h2>
<p>The gilt exemption covers UK government stock only. Bonds issued by other governments, such as US Treasuries, aren’t gilts: gains and losses on them can be chargeable, including gains that come only from the exchange rate.</p>

<h2>The interest is taxable</h2>
<p>Gilt coupons are savings interest. They count towards your Personal Savings Allowance, and anything above it is taxed at your Income Tax rate (see the <a href="${DIVIDENDS_PATH}">dividends and interest guide</a>).</p>
<p>When you buy or sell between coupon dates, the price includes the interest built up since the last coupon (accrued interest). If the total face value of all the bonds you hold is more than £5,000 at any time in the tax year or the year before, the <a href="${HS343}">Accrued Income Scheme</a> applies: accrued interest you receive when selling is taxed as interest, and accrued interest you pay when buying can be taken off the interest you receive.</p>

<h2>What the calculator does with gilts</h2>
<p>The <a href="/">calculator</a> doesn’t calculate bonds. In an Interactive Brokers export, it leaves bond trades out and lists each one after the import, so none are lost silently:</p>
<ul>
<li><strong>UK gilts</strong> (symbols starting UKT) are listed as exempt. They don’t need anything else.</li>
<li><strong>Other bonds</strong> are listed as not supported. If a bond’s gain is chargeable, add its trades in a <a href="${GENERIC_CSV_PATH}">Generic CSV</a> file, using the amounts you paid and received.</li>
</ul>
<p>Coupons and the accrued interest in the export are still read as interest. Your files never leave your browser. For how the rules work on shares, see the <a href="${OVERVIEW_PATH}">overview of HMRC’s share rules</a>.</p>

<div class="callout info"><p>This guide assumes you’re UK resident and hold gilts directly, not through a fund. Gains on a gilt fund or ETF are taxed like other fund units. HMRC references: <a href="${CG54900}">CG54900</a>, <a href="${CG54224}">CG54224</a> and helpsheet <a href="${HS343}">HS343</a>.</p></div>
`,
  section: 'rules',
  jsonLd: [{
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url: 'https://cgtvisualiser.co.uk' + GILTS_PATH,
    inLanguage: 'en-GB',
    isAccessibleForFree: true,
    dateModified: '2026-11-18',
    publisher: { '@type': 'Organization', name: 'Capital Gains Tax Visualiser', url: 'https://cgtvisualiser.co.uk/' },
  }],
  related: [DIVIDENDS_PATH, OVERVIEW_PATH],
}
