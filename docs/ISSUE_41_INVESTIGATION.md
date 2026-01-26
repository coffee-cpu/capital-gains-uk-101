# Investigation: RSU Lapse Date vs Deposit Date Discrepancy (Issue #41)

## Summary

GitHub Issue #41 reports that the Schwab Equity Awards parser uses the RSU lapse date from CSV files as the acquisition date. However, shares typically deposit the following business day, creating a date mismatch that can incorrectly prevent the Same-Day Rule (TCGA92/S105(1)) from applying.

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

Under UK tax rules:
- **TCGA92/S17**: Acquisition occurs when there's an "acquisition" of the asset
- **TCGA92/S127**: Share reorganisations and vesting events
- For RSUs, the acquisition date is typically when the restriction "lapses" and the employee has unconditional ownership (the lapse date)

However, for Same-Day Rule matching (TCGA92/S105(1)), the practical issue is that employees often sell shares on the deposit date (when they first appear in their account), not the lapse date.

### Same-Day Rule Application

The Same-Day Rule matches acquisitions and disposals on the **same calendar day**. If an employee:
1. Has RSUs lapse on May 15
2. Sells immediately when shares appear on May 16
3. The CGT calculation should arguably use Same-Day matching

The discrepancy creates a tax reporting inconsistency.

## Proposed Solutions

### Solution 1: Automatic +1 Business Day Offset

Automatically adjust RSU lapse dates forward by 1 business day.

**Pros:**
- Automatic, no user intervention
- Fixes the common T+1 deposit scenario

**Cons:**
- Not always accurate (T+1 is typical but not guaranteed)
- Weekends/holidays may push settlement further
- Different countries have different banking holidays
- Makes assumptions that may not hold in edge cases

**Implementation complexity:** Medium (requires business day calendar)

### Solution 2: UI Warning

Display a warning when RSU transactions are detected explaining the date discrepancy.

**Pros:**
- Transparent, educational
- No changes to data processing
- Users can make informed decisions

**Cons:**
- Doesn't solve the matching problem by itself
- Requires user to manually adjust if needed

**Implementation complexity:** Low

### Solution 3: Manual Date Editing Post-Import

Allow users to edit transaction dates after import.

**Pros:**
- Most flexible - user has full control
- Works for any edge case
- No assumptions about settlement timing

**Cons:**
- Requires user effort
- User needs to know about the issue
- May require additional UI work

**Implementation complexity:** Medium-High

### Solution 4: Parser Option for Auto-Adjustment

Add a parser option (e.g., checkbox during import) to auto-adjust RSU dates.

**Pros:**
- User opts in explicitly
- Clear about what's happening
- Combines automation with user control

**Cons:**
- Still relies on T+1 assumption
- Additional UI complexity

**Implementation complexity:** Medium

### Solution 5: Store Both Dates

Add a `vest_date` field to preserve the original lapse date, while using a configurable `date` for matching.

**Pros:**
- Preserves audit trail
- Supports flexibility in date selection
- Could show both dates in UI

**Cons:**
- Schema change required
- May complicate UI

**Implementation complexity:** Medium

## Recommended Approach

A phased approach combining multiple solutions:

### Phase 1 (Low effort, immediate value)
1. **Add UI warning** when Schwab Equity Awards transactions are imported
2. **Explain in notes** that the date is the lapse date, not deposit date
3. **Document** the issue in help content

### Phase 2 (Medium effort)
1. **Add parser option** during import: "Use deposit date (+1 business day) for RSU matching"
2. **Implement business day calculation** using a simple UK/US calendar
3. **Preserve original vest date** in transaction notes or a new field

### Phase 3 (Higher effort, longer term)
1. **Manual date editing** capability in the transaction list
2. **Bulk edit** functionality for adjusting multiple RSU transactions

## Technical Notes

### Files to Modify

1. `src/lib/parsers/schwabEquityAwards.ts` - Add date adjustment logic
2. `src/types/transaction.ts` - Consider adding `vest_date` field
3. `src/components/CSVImporter.tsx` - Add parser options UI
4. `src/utils/businessDays.ts` (new) - Business day calculations
5. `src/components/TransactionList.tsx` - Display warnings/notes

### Testing Considerations

1. Add test cases for date adjustments
2. Test weekend/holiday handling
3. Test Same-Day Rule matching with adjusted dates
4. E2E test for full import-to-CGT workflow with RSUs

## References

- [HMRC CG51560 - Same-day and 30-day matching rules](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560)
- [HMRC CG51620 - Section 104 pooling](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51620)
- [TCGA92/S105(1) - Same-day rule](https://www.legislation.gov.uk/ukpga/1992/12/section/105)
- [TCGA92/S106A - 30-day rule](https://www.legislation.gov.uk/ukpga/1992/12/section/106A)

## Conclusion

Issue #41 identifies a real problem where RSU lapse dates don't align with deposit dates, affecting Same-Day Rule matching. The recommended approach is to start with informative warnings (Phase 1), add optional date adjustment during import (Phase 2), and consider manual editing capabilities long-term (Phase 3).

The most important immediate action is making users aware of this discrepancy so they can verify their CGT calculations are correct for their specific situation.
