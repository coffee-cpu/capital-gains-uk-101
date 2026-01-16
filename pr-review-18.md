# PR #18 Review: NRA Tax Adj as Dividend

## Summary

This PR implements SA106 foreign dividend withholding tax tracking for UK Self Assessment reporting.

## Review History

### Initial Concerns (Addressed ✅)

The original approach proposed treating "NRA Tax Adj" as negative dividends, which would have made it impossible to correctly report to HMRC. **The author has now completely reworked the implementation** to properly support SA106 requirements.

## HMRC Guidance Research

### SA106 Form Requirements

The HMRC SA106 Foreign Income supplementary pages require **separate reporting** of gross dividends and foreign tax withheld:

| Column | Description |
|--------|-------------|
| **Column A** | **Gross income arising** - the gross amount of the dividend **before** any foreign tax was taken off |
| **Column D** | **Foreign tax taken off** - the amount of foreign tax suffered |

Source: [HMRC SA106 Notes 2025](https://assets.publishing.service.gov.uk/media/67da810fa87d546feeda01d7/sa106_Notes_2025.pdf)

### Foreign Tax Credit Relief (FTCR)

When claiming relief for US withholding tax, taxpayers need both figures:

1. **Gross dividend amount** - taxed at UK dividend rates
2. **Foreign tax paid** - used to calculate FTCR credit (limited to the lower of foreign tax paid or UK tax due on that income)

Under the UK-US Double Taxation Agreement, the relief is limited to 15% for most dividends (with a valid W-8BEN).

Source: [HMRC HS263 - Relief for Foreign Tax Paid 2025](https://www.gov.uk/government/publications/calculating-foreign-tax-credit-relief-on-income-hs263-self-assessment-helpsheet/relief-for-foreign-tax-paid-2025-hs263)

---

## Updated Implementation Review

### What Changed

The PR has been completely reworked with a proper SA106-compliant approach:

| Component | Implementation |
|-----------|----------------|
| **Transaction types** | Added `grossDividend` and `withholdingTax` fields |
| **Schwab parser** | Two-pass algorithm to associate NRA Tax Adj rows with corresponding dividend entries |
| **Other parsers** | Updated Freetrade, Interactive Brokers, Trading 212 to capture withholding tax |
| **FX conversion** | SA106 fields are converted to GBP |
| **UI component** | New amber-styled SA106 Foreign Income Summary panel |
| **PDF export** | Added SA106 section showing gross, withheld, and net amounts |
| **Tests** | 15 new SA106 integration tests (369 total passing) |

### How It Aligns with HMRC Requirements

The new implementation correctly provides:

```
SA106 Column A (Gross income):     Σ grossDividend fields → £X
SA106 Column D (Foreign tax):      Σ withholdingTax fields → £Y
Net dividends received:            £X - £Y (for user reference)
```

This allows users to:
1. ✅ Report gross dividend income for SA106 Column A
2. ✅ Report foreign tax withheld for SA106 Column D
3. ✅ Correctly claim Foreign Tax Credit Relief
4. ✅ See net dividend amounts in the UI

### Remaining Considerations

1. **UK vs Foreign Dividends**: The author notes that determining whether a dividend is UK or foreign is "an exercise for the user." This is reasonable - the tool correctly captures the data, and users must determine sourcing based on their holdings.

2. **DTA Rate Limits**: FTCR is limited by the Double Taxation Agreement rate (15% for US dividends with W-8BEN). Users claiming FTCR should verify they're not claiming more than the DTA-allowed rate. Consider adding a note about this in the UI.

3. **Multiple Countries**: If users have dividends from multiple countries, they need separate FTCR calculations per HMRC HS263. The current implementation appears to aggregate all foreign withholding - consider whether per-country breakdown would be helpful.

---

## Recommendation: **Approve** ✅

The updated implementation properly addresses HMRC SA106 requirements by:
- Preserving gross dividend and withholding tax as separate tracked values
- Providing UI summaries that display both figures
- Including SA106 guidance in the PDF export

This is exactly the approach I recommended in my initial review. The author has done excellent work evolving this PR.

### Minor Suggestions (Non-blocking)

1. Add a brief note in the UI about the 15% DTA rate limit for US dividends
2. Consider per-country withholding breakdown for future enhancement
3. Link to HMRC HS263 in the UI for users unfamiliar with FTCR

## References

- [SA106 Form 2025 (PDF)](https://assets.publishing.service.gov.uk/media/67da80ed69606cdea9e087d6/sa106_2025.pdf)
- [HMRC HS263 - Relief for Foreign Tax Paid](https://www.gov.uk/government/publications/calculating-foreign-tax-credit-relief-on-income-hs263-self-assessment-helpsheet/relief-for-foreign-tax-paid-2025-hs263)
- [GOV.UK - Tax on Foreign Income](https://www.gov.uk/tax-foreign-income/paying-tax)
- [ICAEW - Check claims for FTCR](https://www.icaew.com/insights/tax-news/2025/nov-2025/check-claims-for-foreign-tax-credit-relief-says-hmrc)

## Conclusion

The PR now correctly implements SA106 foreign dividend tracking. The separate `grossDividend` and `withholdingTax` fields enable proper HMRC reporting while the UI provides helpful summaries. **Recommend merging.**
