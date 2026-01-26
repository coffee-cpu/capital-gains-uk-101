# Investigation: Issue #44 - Tax on interest being reported as Transfer

## Issue Summary
Tax on interest is being reported as "Transfer" and not being deducted from total taxable interest.

## Root Cause Analysis

After investigating the codebase, I identified **two distinct issues**:

### Issue 1: Parser Classification Bug (Schwab)

In the Schwab parser (`src/lib/parsers/schwab.ts`), the action type mapping at lines 267-281 has a problematic order and missing patterns:

```typescript
} else if (actionLower.includes('dividend') || actionLower === 'nra tax adj') {
    type = TransactionType.DIVIDEND
} else if (actionLower.includes('interest')) {
    type = TransactionType.INTEREST
} else if (actionLower.includes('tax')) {
    type = TransactionType.TAX
} else if (actionLower.includes('wire') || actionLower.includes('transfer') || ...) {
    type = TransactionType.TRANSFER
} else {
    // Return TRANSFER as a fallback for unknown actions
    type = TransactionType.TRANSFER
}
```

**Problems identified:**

1. **Missing "withholding" keyword**: Unlike Trading 212 and Revolut parsers, Schwab doesn't check for `actionLower.includes('withholding')` to map to TAX type. If Schwab has an action like "Backup Withholding" or "W-8 Withholding" (without "tax" in it), it falls through to TRANSFER.

2. **TRANSFER as fallback**: Unknown actions default to TRANSFER, which can cause legitimate tax-related transactions to be misclassified.

3. **Order of checks matters**: If an action contains both "interest" and "tax" (e.g., "Interest Tax Withheld"), it matches 'interest' first and becomes INTEREST, not TAX.

### Issue 2: Missing Interest Withholding Tax Handling (Feature Gap)

Unlike dividends, interest income doesn't have withholding tax tracking:

**Dividend handling (fully implemented):**
- `grossDividend` and `withholdingTax` fields on `GenericTransaction`
- CGT engine calculates `grossDividendsGbp` and `totalWithholdingTaxGbp`
- UI displays SA106 foreign dividend summary with gross, tax withheld, and net amounts

**Interest handling (incomplete):**
- Only `total` field for the net interest amount
- No `grossInterest` or `interestWithholdingTax` fields
- CGT engine only sums `value_gbp` from INTEREST transactions
- No deduction of tax from interest total

## Affected Files

| File | Issue |
|------|-------|
| `src/lib/parsers/schwab.ts` | Missing "withholding" keyword check; TRANSFER fallback |
| `src/types/transaction.ts` | Missing `grossInterest`, `interestWithholdingTax` fields |
| `src/lib/cgt/engine.ts` | No interest withholding tax calculation |
| `src/components/TaxYearSummary.tsx` | No interest withholding display |

## Broker-Specific Behavior

| Broker | Unknown Action Fallback | "Withholding" Keyword |
|--------|------------------------|----------------------|
| Trading 212 | FEE | Handled (→ TAX) |
| Schwab | **TRANSFER** | **Not handled** |
| Revolut | FEE | Handled (→ TAX) |
| Freetrade | Filtered out (null) | N/A |
| Interactive Brokers | Filtered out (null) | N/A |
| Coinbase | TRANSFER | Not handled |

## Recommended Fix

### Phase 1: Fix Parser Classification (Quick Fix)

**File: `src/lib/parsers/schwab.ts`**

Add "withholding" check before the TRANSFER check:

```typescript
} else if (actionLower.includes('tax') || actionLower.includes('withholding')) {
    type = TransactionType.TAX
}
```

### Phase 2: Add Interest Withholding Tax Support (Feature Enhancement)

1. **Add fields to `GenericTransaction`** in `src/types/transaction.ts`:
   ```typescript
   grossInterest?: number | null
   interestWithholdingTax?: number | null
   ```

2. **Update parsers** to populate these fields when interest withholding is detected

3. **Update CGT engine** to calculate:
   - `grossInterestGbp`
   - `totalInterestWithholdingTaxGbp`

4. **Update UI** to show interest withholding in Tax Year Summary similar to dividends

## Testing Recommendations

1. Create test CSV with Schwab-style "Backup Withholding" or similar action
2. Verify it's classified as TAX, not TRANSFER
3. Add E2E test for interest withholding tax display

## Priority

- **Phase 1**: High (fixes misclassification bug)
- **Phase 2**: Medium (feature enhancement for completeness)

## Notes

- This issue primarily affects US brokers (Schwab, Coinbase) where backup withholding or NRA withholding on interest may occur
- UK brokers (Trading 212, Freetrade) typically pay interest gross with no withholding
- Interactive Brokers users would not see this issue because unknown transaction types are filtered out entirely
