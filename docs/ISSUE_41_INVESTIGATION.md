# Investigation: RSU Lapse Date vs Deposit Date Discrepancy (Issue #41)

## Summary

GitHub Issue #41 reports that the Schwab Equity Awards parser uses the RSU lapse date from CSV files as the acquisition date. However, shares typically deposit the following business day, creating a date mismatch that can incorrectly prevent the Same-Day Rule (TCGA92/S105(1)) from applying.

**Key Finding: The current implementation using the lapse/vesting date is CORRECT per HMRC guidance.** The vesting date is the acquisition date for CGT purposes. See HMRC Research section below.

## Problem Analysis

### Example Scenario

| Event | Date | Source |
|-------|------|--------|
| RSU Lapse | 2025-05-15 | Schwab Equity Awards CSV |
| Deposit | 2025-05-16 | Brokerage account |
| Sale | 2025-05-16 | Schwab Transactions CSV |

When a user imports both files:
1. The RSU acquisition is recorded as 2025-05-15 (from Equity Awards CSV)
2. The sale is recorded as 2025-05-16 (from regular Schwab CSV)
3. The CGT engine doesn't match them as "same-day" since dates differ by 1 day
4. Section 104 Pool matching is used instead of Same-Day Rule

**However:** If the dates genuinely differ, the Same-Day Rule correctly does NOT apply. These are different days.

### Current Implementation

The issue is in `src/lib/parsers/schwabEquityAwards.ts:41`:

```typescript
const date = parseSchwabDate(transactionRow['Date'])
```

The `Date` column in Schwab Equity Awards CSV contains the **lapse date** (when RSUs vest), not the deposit date (when shares appear in the account).

### CSV Format

Schwab Equity Awards CSV uses paired rows:
```csv
"Date","Action","Symbol","Description","Quantity",...
"08/15/2024","Lapse","AAPL","Restricted Stock Lapse","100",...  <-- Transaction row
"","","","","","03/20/2023","123456","$150.00",...              <-- Detail row with award info
```

The Date on the transaction row is the lapse date. There is **no deposit date** in this CSV format.

## HMRC Tax Considerations

### Acquisition Date for RSUs

Based on HMRC guidance and UK tax law:

1. **Acquisition Date = Vesting Date**: For CGT purposes, the acquisition date is when RSUs vest (restrictions lapse) and the employee gains unconditional ownership. This is the **lapse date**, not the deposit date.

2. **Cost Basis = Market Value at Vesting**: Per TCGA92/S119A, the acquisition cost is the market value at vesting, which is also the amount taxed as employment income via PAYE.

3. **Disposal Date = Trade Date**: For share sales, HMRC uses the trade date (when you place the order), not the settlement date (T+2).

References:
- [HMRC CG56328](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg56328) - Employment-related securities and income tax interaction
- [HMRC CG56339](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg56339) - Restricted securities
- [HMRC ERSM20192](https://www.gov.uk/hmrc-internal-manuals/employment-related-securities/ersm20192) - LTIPs and RSUs
- TCGA92/S119A - Prevents double taxation by adding employment income to CGT cost basis

### Same-Day Rule Application

The Same-Day Rule (TCGA92/S105(1)) matches acquisitions and disposals on the **same calendar day**.

**Key insight from research:**
- If an employee does a "sell-to-cover" or immediate sale, the **trade date** is the vesting date
- Both acquisition and disposal would be on the same day → Same-Day Rule applies
- The deposit/settlement happening T+1 or T+2 is irrelevant for CGT date matching

**When Same-Day Rule correctly does NOT apply:**
- If the employee waits until shares deposit (Day+1) before selling
- Acquisition = Day 0 (vesting), Disposal = Day 1 (sale) → Different days
- Section 104 Pool matching is the correct treatment

### Can Employees Actually Sell on Vesting Day?

Yes. "Sell-to-cover" transactions are placed on the vesting date:
- The sale order executes on the vesting date
- Settlement happens T+2 later
- For CGT purposes, the trade date (vesting date) is what matters

If someone sells on the vesting date, both the Schwab Equity Awards CSV and regular Schwab CSV should show the **same date**:
- Equity Awards: Lapse date (e.g., May 15)
- Regular Schwab: Trade date (e.g., May 15)
- Same-Day Rule would apply correctly

### The Real Issue

The scenario described in issue #41 (acquisition May 15, sale May 16) represents a case where:
1. The employee did NOT sell on the vesting day
2. They waited until shares deposited (Day+1)
3. The trade genuinely occurred on a different day

**This is NOT a bug** - the Same-Day Rule correctly doesn't apply because these are genuinely different days.

## Alternative Approach Considered

### Using Transaction Date from Charles Schwab Import

The user suggested using the transaction date from the regular "Charles Schwab" CSV import instead of the Equity Awards lapse date.

**Current behavior:**
- Deduplication prefers Equity Awards data over Stock Plan Activity
- Stock Plan Activity shows format like `"08/10/2024 as of 08/09/2024"` where "as of" date is used
- Equity Awards shows just the lapse date

**Analysis:**
This wouldn't help because:
1. The "as of" date in Stock Plan Activity is still the vesting/lapse date
2. The discrepancy isn't between the two CSVs - it's between vesting date and when the user sold
3. If the user sold on vesting day, both CSVs should show the same date anyway

## Previously Proposed Solutions (Now Considered Unnecessary)

The following solutions were initially proposed but are **not recommended** after HMRC research confirmed the current implementation is correct:

1. **Automatic +1 business day offset** - Would be incorrect per HMRC rules
2. **Parser option for auto-adjustment** - Would produce incorrect acquisition dates
3. **Store both dates** - Unnecessary complexity

**What might still be useful:**
- **Documentation/help text** explaining RSU date handling per HMRC rules
- **UI tooltips** clarifying that acquisition date = vesting date, not deposit date

## References

- [HMRC CG51560 - Same-day and 30-day matching rules](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560)
- [HMRC CG51620 - Section 104 pooling](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51620)
- [TCGA92/S105(1) - Same-day rule](https://www.legislation.gov.uk/ukpga/1992/12/section/105)
- [TCGA92/S106A - 30-day rule](https://www.legislation.gov.uk/ukpga/1992/12/section/106A)

## Conclusion

**The current implementation is CORRECT.**

After researching HMRC guidance:

1. **Acquisition date = Vesting/lapse date** - This is when the employee gains unconditional ownership of the shares. The current parser correctly uses this date.

2. **Deposit date is irrelevant** - The deposit/settlement is an administrative detail, not a tax event. HMRC uses trade dates for CGT, not settlement dates.

3. **Same-Day Rule behavior is correct** - If someone sells on Day+1 (after deposit), these are genuinely different days and the Same-Day Rule correctly doesn't apply.

4. **True same-day sales work correctly** - If an employee does a "sell-to-cover" on the vesting day, both the Equity Awards and regular Schwab CSV should show the same date, and the Same-Day Rule will apply.

### Recommendation

**No code changes required.** The issue #41 scenario represents correct behavior, not a bug.

However, we could consider adding:
- **Documentation/help text** explaining that RSU acquisition date = vesting date per HMRC rules
- **UI note** on RSU transactions clarifying the date is the vesting date (not deposit date)

This would help users understand why dates might differ from what they expect based on when shares appeared in their account.

### Sources

- [Paying tax on Restricted Stock Units | GoSimpleTax](https://www.gosimpletax.com/blog/paying-tax-on-restricted-stock-units/)
- [RSU Tax UK Guide | ESDG Accountancy](https://esdgaccountancy.com/post/rsu-tax-self-assessment-in-the-uk-a-guide-for-tech-employees/)
- [HMRC ERSM20192 - LTIPs and RSUs](https://www.gov.uk/hmrc-internal-manuals/employment-related-securities/ersm20192)
- [HMRC CG56328 - Employment-related securities](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg56328)
- [RSU Tax & Self-Assessment | Taxd](https://www.taxd.co.uk/blog/rsu-tax-uk-and-self-assessment-a-tech-employee-s-guide)
