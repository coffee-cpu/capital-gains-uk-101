/**
 * Help Panel Content
 *
 * Structured content for the context-sensitive help panel showing
 * detailed explanations of CGT rules, examples, and HMRC references.
 */

export type HelpContext = 'default' | 'same-day' | '30-day' | 'section104' | 'stock-split' | 'tax-year' | 'dividend'

export interface HelpContent {
  title: string
  hmrcReference?: string
  explanation: string
  example?: {
    title: string
    scenario: string
    calculation: string[]
    result: string
  }
  references: Array<{
    title: string
    url: string
    description: string
  }>
}

export const helpContent: Record<HelpContext, HelpContent> = {
  default: {
    title: 'HMRC CGT Matching Rules',
    explanation: `When you sell shares, HMRC requires you to match the sale with your share purchases in a specific order:

1. **Same-Day Rule**: First, match with shares bought on the same day as the sale
2. **30-Day Rule**: Next, match with shares bought within 30 days after the sale (anti-avoidance)
3. **Section 104 Pool**: Finally, match with your remaining shares using average cost basis

This order prevents tax avoidance strategies like "bed and breakfast" where investors would sell shares to realize losses and immediately buy them back.`,
    references: [
      {
        title: 'CG51560 - Share matching rules',
        url: 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560',
        description: 'Official HMRC guidance on same-day and 30-day matching rules'
      },
      {
        title: 'CG51620 - Section 104 holdings',
        url: 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51620',
        description: 'Official HMRC guidance on pooled share holdings'
      },
      {
        title: 'HS284 - Shares and Capital Gains Tax',
        url: 'https://www.gov.uk/government/publications/shares-and-capital-gains-tax-hs284-self-assessment-helpsheet/hs284-shares-and-capital-gains-tax-2024',
        description: 'HMRC helpsheet for individuals'
      }
    ]
  },

  'same-day': {
    title: 'Same-Day Rule',
    hmrcReference: 'TCGA92/S105(1)',
    explanation: `The Same-Day Rule is the first matching rule applied. Shares bought and sold on the exact same calendar day are matched together.

**Why it exists**: This is the most straightforward matching method. If you buy and sell shares on the same day, those transactions are clearly related.

**How it works**:
- If you sell 100 shares on June 15, 2024
- And you bought 50 shares on June 15, 2024
- Those 50 shares are matched first using the same-day rule
- The purchase price of those 50 shares determines your cost basis

**Important**: The matching happens regardless of the order of transactions within the day. Even if the sale happened before the purchase in the same day, they still match.`,
    example: {
      title: 'Same-Day Matching Example',
      scenario: 'You bought 100 shares of AAPL at £150 each in the morning, and sold 100 shares at £160 each in the afternoon on the same day.',
      calculation: [
        'Shares sold: 100',
        'Sale price: £160 per share',
        'Proceeds: 100 × £160 = £16,000',
        '',
        'Shares bought (same day): 100',
        'Purchase price: £150 per share',
        'Cost basis: 100 × £150 = £15,000',
        '',
        'Gain = £16,000 - £15,000 = £1,000'
      ],
      result: 'All 100 shares match under the same-day rule. Capital gain: £1,000'
    },
    references: [
      {
        title: 'CG51560 - Same-day rule',
        url: 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560',
        description: 'Official HMRC guidance on same-day matching (TCGA92/S105(1))'
      },
      {
        title: 'TCGA 1992 Section 105',
        url: 'https://www.legislation.gov.uk/ukpga/1992/12/section/105',
        description: 'Legislation: Disposal on same day as acquisition'
      }
    ]
  },

  '30-day': {
    title: '30-Day Rule (Bed & Breakfast)',
    hmrcReference: 'TCGA92/S106A(5)',
    explanation: `The 30-Day Rule (also called the "Bed and Breakfast" rule) is an anti-avoidance measure. After same-day matching, shares sold are matched with shares bought within the next 30 days.

**Why it exists**: In the past, investors would sell shares to realize a loss for tax purposes, then buy them back the next day to maintain their position. This rule prevents that strategy.

**How it works**:
- If you sell shares on June 15, 2024
- And you buy shares of the same company between June 16-July 14, 2024 (next 30 days)
- Those purchases are matched against your sale
- This happens even if you already owned other shares

**Important**: The 30-day window starts the day AFTER the sale. If you sell on June 15, the window runs from June 16 to July 15 (inclusive).

**Matching order within 30 days**: Earliest acquisitions are matched first (FIFO within the 30-day window).`,
    example: {
      title: '30-Day Rule Example',
      scenario: 'On June 1, you sold 100 shares at £200 each. On June 20 (19 days later), you bought back 50 shares at £180 each. You also have 200 shares in your Section 104 pool.',
      calculation: [
        'Sale on June 1: 100 shares at £200',
        'Proceeds: 100 × £200 = £20,000',
        '',
        'Matched with June 20 purchase (30-day rule): 50 shares',
        'Cost basis: 50 × £180 = £9,000',
        'Gain on these 50: (50 × £200) - £9,000 = £1,000',
        '',
        'Remaining 50 shares matched with Section 104 pool',
        'Pool average cost: £150 per share',
        'Cost basis: 50 × £150 = £7,500',
        'Gain on these 50: (50 × £200) - £7,500 = £2,500',
        '',
        'Total gain: £1,000 + £2,500 = £3,500'
      ],
      result: '50 shares matched under 30-day rule, 50 under Section 104. Total gain: £3,500'
    },
    references: [
      {
        title: 'CG51560 - 30-day rule',
        url: 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560',
        description: 'Official HMRC guidance on the bed & breakfast rule (TCGA92/S106A)'
      },
      {
        title: 'TCGA 1992 Section 106A',
        url: 'https://www.legislation.gov.uk/ukpga/1992/12/section/106A',
        description: 'Legislation: Identification of relevant securities'
      }
    ]
  },

  section104: {
    title: 'Section 104 Pool',
    hmrcReference: 'TCGA92/S104',
    explanation: `The Section 104 Pool is the final matching rule. All shares that don't match under same-day or 30-day rules go into a "pool" where they share an average cost basis.

**Why it exists**: Section 104 pooling (introduced in 1985) simplifies share tracking by treating all shares of the same company as a single pool with an average cost, rather than tracking each purchase separately.

**How it works**:
- All purchases that don't match same-day or 30-day rules go into the pool
- The pool tracks: total quantity and total cost
- Average cost = total cost ÷ total quantity
- When you sell, shares are matched against this average cost
- The pool is updated after each transaction

**Pool operations**:
- **Buy**: Adds quantity and cost to the pool
- **Sell**: Removes quantity and proportional cost from the pool
- **Stock split**: Adjusts quantity but not total cost (cost per share decreases)

**Historical note**: Before April 2008, calculations were more complex with indexation allowance and taper relief. Since 2008, it's simply average cost basis.`,
    example: {
      title: 'Section 104 Pool Example',
      scenario: 'You have bought shares over several years. Now you sell 150 shares at £250 each.',
      calculation: [
        'Your Section 104 Pool before sale:',
        '  Quantity: 500 shares',
        '  Total cost: £75,000',
        '  Average cost: £75,000 ÷ 500 = £150 per share',
        '',
        'Sale: 150 shares at £250',
        'Proceeds: 150 × £250 = £37,500',
        '',
        'Cost basis from pool:',
        '  150 × £150 (average cost) = £22,500',
        '',
        'Gain = £37,500 - £22,500 = £15,000',
        '',
        'Pool after sale:',
        '  Quantity: 350 shares (500 - 150)',
        '  Total cost: £52,500 (£75,000 - £22,500)',
        '  Average cost: £150 per share (unchanged)'
      ],
      result: '150 shares matched from Section 104 pool at average cost £150. Gain: £15,000'
    },
    references: [
      {
        title: 'CG51620 - Section 104 holdings',
        url: 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51620',
        description: 'Official HMRC guidance on share pooling (TCGA92/S104)'
      },
      {
        title: 'TCGA 1992 Section 104',
        url: 'https://www.legislation.gov.uk/ukpga/1992/12/section/104',
        description: 'Legislation: Shares pooling rules'
      }
    ]
  },

  'stock-split': {
    title: 'Stock Splits',
    hmrcReference: 'TCGA92/S127',
    explanation: `A stock split is a reorganization where a company increases the number of shares by dividing existing shares. For tax purposes, this is NOT a disposal.

**HMRC Treatment**: Under TCGA92/S127, a stock split is treated as a "reorganization of share capital" where:
- No gain or loss arises from the split itself
- The total cost basis remains unchanged
- The cost is spread across the new (larger) number of shares
- Pre-split and post-split shares are treated as the same asset

**How this app handles splits**:
1. Stock split transactions are recorded with type STOCK_SPLIT
2. All pre-split transactions are "normalized" to post-split quantities
3. Original quantities are preserved for audit purposes
4. CGT calculations use split-adjusted quantities for accurate matching

**Example ratios**:
- 2:1 split = Each share becomes 2 shares (multiplier: 2.0)
- 4:1 split = Each share becomes 4 shares (multiplier: 4.0)
- 1:10 reverse split = 10 shares become 1 share (multiplier: 0.1)`,
    example: {
      title: 'Stock Split Example',
      scenario: 'You bought 25 shares of AAPL at £360 each on June 1, 2020. On August 31, 2020, Apple did a 4:1 stock split. You later sell 100 shares at £120 each.',
      calculation: [
        'Original purchase (pre-split):',
        '  25 shares × £360 = £9,000 total cost',
        '',
        'After 4:1 split on August 31, 2020:',
        '  Quantity: 25 × 4 = 100 shares',
        '  Price per share: £360 ÷ 4 = £90',
        '  Total cost: £9,000 (unchanged)',
        '',
        'Sale of 100 shares at £120:',
        '  Proceeds: 100 × £120 = £12,000',
        '  Cost basis: 100 × £90 = £9,000',
        '  Gain: £12,000 - £9,000 = £3,000'
      ],
      result: 'The split doesn\'t create a taxable event. The gain is calculated using split-adjusted quantities.'
    },
    references: [
      {
        title: 'CG51700 - Share reorganisations',
        url: 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51700',
        description: 'Official HMRC guidance on share reorganizations including stock splits'
      },
      {
        title: 'TCGA 1992 Section 127',
        url: 'https://www.legislation.gov.uk/ukpga/1992/12/section/127',
        description: 'Legislation: Reorganisation of share capital'
      },
      {
        title: 'CG51730 - Stock dividends and stock splits',
        url: 'https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51730',
        description: 'Specific guidance on bonus issues and splits'
      }
    ]
  },

  'tax-year': {
    title: 'UK Tax Year',
    explanation: `The UK tax year runs from 6 April to 5 April of the following year. This is different from the calendar year (January-December) used in many other countries.

**Tax year format**: Tax years are written as "2023/24" meaning:
- Start: 6 April 2023
- End: 5 April 2024

**Why 6 April?**: Historical reasons dating back to 1752 when Britain adopted the Gregorian calendar. The old quarter day (25 March) was moved forward 11 days to 5 April, and the tax year starts the day after.

**For CGT purposes**:
- All disposals (sales) are allocated to the tax year they occurred in
- Annual exempt amount applies per tax year
- Losses can be carried forward to future tax years
- You must report gains above the exempt amount in your Self Assessment tax return

**Annual Exempt Amount** (tax-free allowance):
- 2024/25: £3,000
- 2023/24: £6,000
- 2022/23: £12,300
- 2021/22: £12,300
- 2020/21: £12,300

The allowance has been significantly reduced in recent years.`,
    references: [
      {
        title: 'Tax year dates',
        url: 'https://www.gov.uk/self-assessment-tax-returns/deadlines',
        description: 'Official guidance on tax year dates and deadlines'
      },
      {
        title: 'CGT annual exempt amount',
        url: 'https://www.gov.uk/government/publications/rates-and-allowances-capital-gains-tax/capital-gains-tax-rates-and-annual-tax-free-allowances',
        description: 'Current and historical CGT allowances'
      },
      {
        title: 'Self Assessment deadlines',
        url: 'https://www.gov.uk/self-assessment-tax-returns/deadlines',
        description: 'When to report capital gains'
      }
    ]
  },

  dividend: {
    title: 'Dividend Tax',
    explanation: `Dividend tax is calculated **separately** from capital gains tax. Dividends are distributions of a company's profits paid to shareholders.

**Tax treatment**:
- Dividends are not subject to CGT - they have their own tax rules
- You receive a dividend allowance each tax year
- Dividends above the allowance are taxed at dividend tax rates
- These rates are different from (and lower than) income tax and CGT rates

**Dividend Allowance** (tax-free threshold):
- 2024/25 onwards: £500
- 2023/24: £1,000
- 2018/19 to 2022/23: £2,000
- 2016/17 to 2017/18: £5,000
- Before 2016: No allowance (different system)

**Dividend Tax Rates** (on amounts above allowance):
- Basic rate taxpayers: 8.75%
- Higher rate taxpayers: 33.75%
- Additional rate taxpayers: 39.35%

**Reporting requirements**:
- Dividends under £500: No reporting required
- £500-£10,000: Must inform HMRC (letter or phone)
- Over £10,000: Must complete Self Assessment tax return

**Important**: This visualizer tracks dividend income per tax year to help you determine if you need to report. It does NOT calculate the actual dividend tax owed - consult HMRC guidance or a tax advisor for that.`,
    example: {
      title: 'Dividend Tax Example',
      scenario: 'In the 2024/25 tax year, you received £2,500 in dividends from UK companies. You are a basic rate taxpayer.',
      calculation: [
        'Total dividends received: £2,500',
        'Less: Dividend allowance (2024/25): £500',
        'Taxable dividends: £2,000',
        '',
        'Tax calculation:',
        '  £2,000 × 8.75% (basic rate) = £175',
        '',
        'Reporting requirement:',
        '  Dividends > £500 but < £10,000',
        '  → Must inform HMRC (letter or phone acceptable)'
      ],
      result: 'You owe £175 in dividend tax and must inform HMRC about these dividends.'
    },
    references: [
      {
        title: 'Tax on dividends - Gov.uk',
        url: 'https://www.gov.uk/tax-on-dividends',
        description: 'Official HMRC guidance on dividend tax rates, allowances, and reporting'
      },
      {
        title: 'Dividend allowances',
        url: 'https://www.gov.uk/government/publications/dividend-allowance-factsheet/dividend-allowance-factsheet',
        description: 'Detailed factsheet on dividend allowance changes'
      }
    ]
  }
}

/**
 * Get help content for a specific context
 */
export function getHelpContent(context: HelpContext): HelpContent {
  return helpContent[context]
}

/**
 * Get all available help contexts
 */
export function getAvailableContexts(): HelpContext[] {
  return Object.keys(helpContent) as HelpContext[]
}
