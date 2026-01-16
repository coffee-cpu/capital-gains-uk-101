# PR #18 Review: NRA Tax Adj as Dividend

## Summary

This PR proposes treating "NRA Tax Adj" (Non-Resident Alien Tax Adjustment - US withholding tax on dividends) as a negative dividend rather than a separate TAX transaction. The PR author correctly flagged uncertainty about this approach.

## HMRC Guidance Research

Based on my research of HMRC requirements, **the PR author's concern is valid - this approach would make it difficult for users to correctly report foreign dividends to HMRC.**

### SA106 Form Requirements

The HMRC SA106 Foreign Income supplementary pages require **separate reporting** of gross dividends and foreign tax withheld:

| Column | Description |
|--------|-------------|
| **Column A** | **Gross income arising** - the gross amount of the dividend **before** any foreign tax was taken off |
| **Column D** | **Foreign tax taken off** - the amount of foreign tax suffered |

Source: [HMRC SA106 Notes 2025](https://assets.publishing.service.gov.uk/media/67da810fa87d546feeda01d7/sa106_Notes_2025.pdf), [IRIS Tax Help](https://help-iris.co.uk/elements/tax/returns/individual/section/dividends-from-foreign-companies.htm)

### Foreign Tax Credit Relief (FTCR)

When claiming relief for US withholding tax, taxpayers need both figures:

1. **Gross dividend amount** - taxed at UK dividend rates
2. **Foreign tax paid** - used to calculate FTCR credit (limited to the lower of foreign tax paid or UK tax due on that income)

Under the UK-US Double Taxation Agreement, the relief is limited to 15% for most dividends (with a valid W-8BEN). If a taxpayer paid 15% US withholding, they can claim up to 15% FTCR against their UK tax liability.

Source: [HMRC HS263 - Relief for Foreign Tax Paid 2025](https://www.gov.uk/government/publications/calculating-foreign-tax-credit-relief-on-income-hs263-self-assessment-helpsheet/relief-for-foreign-tax-paid-2025-hs263)

### Example Using PR's Scenario

For MSFT dividend with $182.00 gross and $27.30 (15%) withholding:

**Current SA106 Reporting (Correct)**:
- Column A (Gross income): £145.60 (at ~$1.25/£1)
- Column D (Foreign tax): £21.84

**With PR's Approach**:
- User would only see: £123.76 (net dividend)
- No separate withholding amount available for Column D
- Cannot correctly claim FTCR

## Recommendation: Do Not Merge

The PR's approach would **prevent users from correctly completing their UK Self Assessment tax return**. The TAX transaction type should be preserved for NRA Tax Adj entries.

### Current Behavior (Correct)
```
MSFT Qualified Dividend: +$182.00 (type: DIVIDEND)
MSFT NRA Tax Adj: -$27.30 (type: TAX)
```

This allows users to:
1. Sum DIVIDEND transactions → gross dividend income for Column A
2. Sum TAX transactions → foreign tax withheld for Column D
3. Correctly claim Foreign Tax Credit Relief

### Suggested Improvements (Alternative)

If the goal is to help users visualize net dividend income, consider:

1. **UI Enhancement**: Show a "Net Dividends" summary that displays both gross and net, without modifying the underlying transaction types
2. **Dividend Summary View**: Group related dividend/tax entries by symbol and date, showing:
   - Gross dividend
   - Withholding tax
   - Net received
3. **Tax Report Export**: Generate SA106-ready summaries with properly separated columns

## References

- [SA106 Form 2025 (PDF)](https://assets.publishing.service.gov.uk/media/67da80ed69606cdea9e087d6/sa106_2025.pdf)
- [HMRC HS263 - Relief for Foreign Tax Paid](https://www.gov.uk/government/publications/calculating-foreign-tax-credit-relief-on-income-hs263-self-assessment-helpsheet/relief-for-foreign-tax-paid-2025-hs263)
- [GOV.UK - Tax on Foreign Income](https://www.gov.uk/tax-foreign-income/paying-tax)
- [ICAEW - Check claims for FTCR](https://www.icaew.com/insights/tax-news/2025/nov-2025/check-claims-for-foreign-tax-credit-relief-says-hmrc)

## Conclusion

The PR author's instinct was correct. UK taxpayers **must** report gross dividends and withholding tax separately on SA106 to claim Foreign Tax Credit Relief. Merging these into a single net dividend value would break HMRC compliance. Recommend closing this PR and implementing UI-level summaries instead if net dividend visibility is desired.
