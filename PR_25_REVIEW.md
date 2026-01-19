# PR #25 Review: CGT Rate Change Implementation

**PR:** https://github.com/coffee-cpu/capital-gains-uk-101/pull/25
**Title:** feat: add CGT rate change split for 30 October 2024
**Reviewed:** 2026-01-19
**Spec Document:** `docs/CGT_RATE_CHANGE_2024-25.md`

---

## Executive Summary

PR #25 successfully implements the **core data splitting** for the 30 October 2024 CGT rate change, but requires updates to:
1. ✅ Correctly determine when Box 51 adjustment is required
2. ✅ Improve user messaging and guidance
3. ✅ Add clear instructions for using HMRC's calculator
4. ✅ Handle edge cases (all before, all after, gains below AEA)

**Overall Assessment:** Good foundation, needs refinement for user clarity and correctness.

---

## What PR #25 Implements Correctly

### ✅ Core Splitting Logic (`src/lib/cgt/engine.ts`)
- Correctly identifies rate change date: `2024-10-30`
- Only applies to tax year `2024/25`
- Splits disposals into before/after periods
- Calculates separate gains/losses for each period
- Computes net gain/loss for both periods

### ✅ Type Definitions (`src/types/cgt.ts`)
- Added 7 new fields to `TaxYearSummary`:
  - `hasRateChange?: boolean`
  - `gainsBeforeRateChange?: number`
  - `lossesBeforeRateChange?: number`
  - `netGainOrLossBeforeRateChange?: number`
  - `gainsAfterRateChange?: number`
  - `lossesAfterRateChange?: number`
  - `netGainOrLossAfterRateChange?: number`
- Fields are optional (don't break other tax years)
- Good JSDoc comments with HMRC link

### ✅ UI Presentation (`src/components/TaxYearSummary.tsx`)
- Clear amber warning box
- Shows breakdown for both periods
- Links to HMRC guidance
- Professional styling

### ✅ PDF Export (`src/components/PDFExport.tsx`)
- Includes rate change section
- Matches UI structure
- Includes HMRC source URL

### ✅ Test Coverage (`src/lib/cgt/__tests__/engine.test.ts`)
- 8 tests covering various scenarios
- Tests disposal exactly on 30 Oct (edge case)
- Tests gains/losses split
- Tests other tax years

---

## Critical Finding: SA108 Form Structure

### How the SA108 Form Actually Works

**Key Discovery:** The SA108 form does NOT have separate fields for before/after 30 October disposals.

Instead, it has:
- Standard fields for total disposals, gains, losses (calculated at OLD rates by default)
- **Box 51: "Adjustment to capital gains tax"** - where you enter the additional tax due to rate changes

### When Box 51 Adjustment is Required

From official HMRC guidance:

✅ **Adjustment REQUIRED if:**
> "A disposal of assets was made **on or after 30 October 2024**, a self-assessment tax return is being completed for 2024/25, and the net gains for 2024/25 are **more than the annual exempt amount** of £3,000."

❌ **Adjustment NOT required if:**
1. All disposals were **before 30 October 2024**, OR
2. Net gains are **≤ £3,000** (below Annual Exempt Amount)

### Why This Matters

The SA system defaults to calculating CGT using the **OLD rates (10%/20%)** for the entire year.

- **All disposals before 30 Oct:** ✅ Correct (10%/20% applies)
- **Any disposal on/after 30 Oct:** ❌ Incorrect (should be 18%/24% but SA uses 10%/20%)

Therefore, **any disposal on/after 30 Oct requires Box 51 adjustment** (if gains > £3,000).

**Sources:**
- [How to Fill In Box 51 for Crypto Gains (2025)](https://cryptobooks.tax/en/blog/box-51-crypto-tax-uk-cgt)
- [UK Capital Gains Tax 2024/25: Reporting Adjustments](https://accountingscouts.co.uk/news/capital-gains-tax-adjustment-2024-25-uk/)
- [CGT adjustment may be needed to 2024/25 tax returns | ICAEW](https://www.icaew.com/insights/tax-news/2025/mar-2025/cgt-adjustment-may-be-needed-to-2024-25-tax-returns)

---

## What Needs to Change in PR #25

### 1. ⚠️ Fix `requiresAdjustment` Logic (HIGH PRIORITY)

**Current Issue:** Not implemented

**Required Logic:**
```typescript
// Adjustment needed if ANY disposal on/after 30 Oct AND net gain > AEA
const hasDisposalsAfterChange = disposalsAfterChange.length > 0
const totalNetGain = netGainOrLossBeforeRateChange + netGainOrLossAfterRateChange
const ANNUAL_EXEMPT_AMOUNT_2024_25 = 3000

const requiresAdjustment =
  hasDisposalsAfterChange &&
  totalNetGain > ANNUAL_EXEMPT_AMOUNT_2024_25
```

**Add to return:**
```typescript
return {
  hasRateChange: true,
  requiresAdjustment,  // NEW FIELD
  gainsBeforeRateChange,
  lossesBeforeRateChange,
  netGainOrLossBeforeRateChange,
  gainsAfterRateChange,
  lossesAfterRateChange,
  netGainOrLossAfterRateChange,
}
```

**Update type definition** in `src/types/cgt.ts`:
```typescript
/**
 * Whether CGT rate change adjustment is required for Self Assessment Box 51
 * Only true for 2024/25 when ANY disposal on/after 30 Oct AND net gain > £3,000 AEA
 */
requiresAdjustment?: boolean
```

---

### 2. ⚠️ Improve UI Messaging (HIGH PRIORITY)

**Current Issues:**
- Doesn't explain what 10%/20% vs 18%/24% means (basic vs higher rate)
- "Report these periods separately" is unclear
- Doesn't mention Box 51 or the adjustment
- Doesn't explain how to use the figures

**Required Changes:** Show different messages based on `requiresAdjustment` flag.

#### Case A: No Adjustment Required (All Before 30 Oct, or Gains ≤ £3,000)

```tsx
{currentSummary.hasRateChange && !currentSummary.requiresAdjustment && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div className="flex items-start">
      <svg className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      <div className="ml-3 flex-1">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          CGT Rate Change — No Adjustment Required
        </h4>
        <p className="text-xs text-blue-700">
          {currentSummary.netGainOrLossGbp <= (currentSummary.annualExemptAmount || 3000) ? (
            <>
              Your net gain (£{currentSummary.netGainOrLossGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
              is below the Annual Exempt Amount (£{(currentSummary.annualExemptAmount || 3000).toLocaleString('en-GB')}).
              No CGT adjustment is needed despite the 30 October 2024 rate change.
            </>
          ) : (
            <>
              All your disposals were before 30 October 2024, so your Self Assessment will
              calculate correctly using the rates that applied (Basic rate: 10%, Higher rate: 20%).
              No adjustment needed.
            </>
          )}
        </p>
      </div>
    </div>
  </div>
)}
```

#### Case B: Adjustment Required (Any Disposal On/After 30 Oct, Gains > £3,000)

```tsx
{currentSummary.requiresAdjustment && (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
    <div className="flex items-start">
      <svg className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <div className="ml-3 flex-1">
        <h4 className="text-sm font-semibold text-amber-900 mb-2">
          Action Required: CGT Rate Change Adjustment (Box 51)
        </h4>
        <p className="text-xs text-amber-700 mb-3">
          From 30 October 2024, CGT rates increased (<strong>Basic rate: 10% → 18%</strong>, <strong>Higher rate: 20% → 24%</strong>).
          You have {(currentSummary.gainsBeforeRateChange ?? 0) > 0 ? 'disposals in both periods' : 'disposals after 30 October'},
          so your Self Assessment will not calculate the correct tax automatically.
          You <strong>must</strong> use{' '}
          <a
            href="https://www.gov.uk/guidance/work-out-your-capital-gains-tax-adjustment-for-the-2024-to-2025-tax-year"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-900 font-medium"
          >
            HMRC's official calculator
          </a>{' '}
          to work out the Box 51 adjustment.
        </p>

        {/* Split figures display */}
        <div className="space-y-2 text-sm">
          {/* Before 30 Oct section */}
          {(currentSummary.gainsBeforeRateChange ?? 0) > 0 || (currentSummary.lossesBeforeRateChange ?? 0) < 0 ? (
            <>
              <div className="flex justify-between items-center py-1 border-b border-amber-200">
                <span className="text-amber-800 font-medium">Before 30 Oct 2024 (10%/20% rates)</span>
              </div>
              <div className="flex justify-between items-center pl-3">
                <span className="text-amber-700">Gains</span>
                <span className="font-medium text-green-700">
                  £{(currentSummary.gainsBeforeRateChange ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center pl-3">
                <span className="text-amber-700">Losses</span>
                <span className="font-medium text-red-700">
                  (£{Math.abs(currentSummary.lossesBeforeRateChange ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </span>
              </div>
              <div className="flex justify-between items-center pl-3 pb-2">
                <span className="text-amber-800 font-medium">Net</span>
                <span className={`font-semibold ${(currentSummary.netGainOrLossBeforeRateChange ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  £{(currentSummary.netGainOrLossBeforeRateChange ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </>
          ) : null}

          {/* After 30 Oct section */}
          <div className="flex justify-between items-center py-1 border-b border-amber-200 border-t pt-3">
            <span className="text-amber-800 font-medium">From 30 Oct 2024 (18%/24% rates)</span>
          </div>
          <div className="flex justify-between items-center pl-3">
            <span className="text-amber-700">Gains</span>
            <span className="font-medium text-green-700">
              £{(currentSummary.gainsAfterRateChange ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center pl-3">
            <span className="text-amber-700">Losses</span>
            <span className="font-medium text-red-700">
              (£{Math.abs(currentSummary.lossesAfterRateChange ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </span>
          </div>
          <div className="flex justify-between items-center pl-3">
            <span className="text-amber-800 font-medium">Net</span>
            <span className={`font-semibold ${(currentSummary.netGainOrLossAfterRateChange ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              £{(currentSummary.netGainOrLossAfterRateChange ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-3 pt-3 border-t border-amber-200">
          <p className="text-xs text-amber-800 font-semibold mb-1">How to complete your Self Assessment:</p>
          <ol className="text-xs text-amber-700 ml-4 space-y-1 list-decimal">
            <li>
              Open{' '}
              <a
                href="https://www.gov.uk/guidance/work-out-your-capital-gains-tax-adjustment-for-the-2024-to-2025-tax-year"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                HMRC's CGT adjustment calculator
              </a>
            </li>
            <li>Enter the figures shown above for each period</li>
            <li>The calculator will give you a Box 51 adjustment amount</li>
            <li>Enter this amount in <strong>Box 51</strong> (paper SA108) or <strong>"Adjustment to CGT"</strong> field (online)</li>
            <li>Export this page as PDF and attach as evidence to your return</li>
          </ol>
        </div>
      </div>
    </div>
  </div>
)}
```

---

### 3. ⚠️ Update PDF Export (MEDIUM PRIORITY)

Add explanatory header above the rate change section:

```tsx
{taxYearSummary.hasRateChange && (
  <>
    <Text style={styles.subtitle}>CGT Rate Change — 30 October 2024</Text>

    {/* Add this explanatory note */}
    {taxYearSummary.requiresAdjustment && (
      <Text style={{ fontSize: 8, color: '#92400e', marginBottom: 8, fontStyle: 'italic' }}>
        Evidence for Box 51 Adjustment: This split is required when calculating your CGT
        adjustment for the 2024/25 tax year. Use these figures in HMRC's calculator.
      </Text>
    )}

    <View style={[styles.summaryBox, { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' }]}>
      {/* ... rest of existing PDF content ... */}
    </View>
  </>
)}
```

---

### 4. ⚠️ Add Test Cases (MEDIUM PRIORITY)

Add to `src/lib/cgt/__tests__/engine.test.ts`:

```typescript
describe('CGT Rate Change - requiresAdjustment Logic', () => {
  it('should NOT require adjustment when all disposals before 30 Oct', () => {
    const transactions: EnrichedTransaction[] = [
      createTransaction({ id: 'buy-1', date: '2024-04-10', type: 'BUY', quantity: 10, price_gbp: 100, value_gbp: 1000 }),
      createTransaction({ id: 'sell-1', date: '2024-09-15', type: 'SELL', quantity: 10, price_gbp: 500, value_gbp: 5000 }), // £4,000 gain
    ]

    const result = calculateCGT(transactions)
    const summary = result.taxYearSummaries.find(s => s.taxYear === '2024/25')

    expect(summary!.hasRateChange).toBe(true)
    expect(summary!.requiresAdjustment).toBe(false) // All before 30 Oct
    expect(summary!.gainsAfterRateChange).toBe(0)
  })

  it('should require adjustment when all disposals after 30 Oct and gain > £3,000', () => {
    const transactions: EnrichedTransaction[] = [
      createTransaction({ id: 'buy-1', date: '2024-04-10', type: 'BUY', quantity: 10, price_gbp: 100, value_gbp: 1000 }),
      createTransaction({ id: 'sell-1', date: '2024-11-15', type: 'SELL', quantity: 10, price_gbp: 500, value_gbp: 5000 }), // £4,000 gain
    ]

    const result = calculateCGT(transactions)
    const summary = result.taxYearSummaries.find(s => s.taxYear === '2024/25')

    expect(summary!.hasRateChange).toBe(true)
    expect(summary!.requiresAdjustment).toBe(true) // After 30 Oct + gain > £3k
    expect(summary!.gainsBeforeRateChange).toBe(0)
  })

  it('should NOT require adjustment when disposal after 30 Oct but gain ≤ £3,000', () => {
    const transactions: EnrichedTransaction[] = [
      createTransaction({ id: 'buy-1', date: '2024-04-10', type: 'BUY', quantity: 10, price_gbp: 100, value_gbp: 1000 }),
      createTransaction({ id: 'sell-1', date: '2024-11-15', type: 'SELL', quantity: 10, price_gbp: 250, value_gbp: 2500 }), // £1,500 gain
    ]

    const result = calculateCGT(transactions)
    const summary = result.taxYearSummaries.find(s => s.taxYear === '2024/25')

    expect(summary!.hasRateChange).toBe(true)
    expect(summary!.requiresAdjustment).toBe(false) // Gain below £3k AEA
  })

  it('should require adjustment when disposals in both periods and gain > £3,000', () => {
    const transactions: EnrichedTransaction[] = [
      createTransaction({ id: 'buy-1', date: '2024-04-10', type: 'BUY', quantity: 20, price_gbp: 100, value_gbp: 2000 }),
      createTransaction({ id: 'sell-1', date: '2024-09-15', type: 'SELL', quantity: 10, price_gbp: 300, value_gbp: 3000 }), // £2,000 gain
      createTransaction({ id: 'sell-2', date: '2024-11-15', type: 'SELL', quantity: 10, price_gbp: 300, value_gbp: 3000 }), // £2,000 gain
    ]

    const result = calculateCGT(transactions)
    const summary = result.taxYearSummaries.find(s => s.taxYear === '2024/25')

    expect(summary!.hasRateChange).toBe(true)
    expect(summary!.requiresAdjustment).toBe(true) // Both periods + total £4k > £3k AEA
    expect(summary!.gainsBeforeRateChange).toBeGreaterThan(0)
    expect(summary!.gainsAfterRateChange).toBeGreaterThan(0)
  })

  it('should handle disposal exactly on 30 Oct as "after" for adjustment logic', () => {
    const transactions: EnrichedTransaction[] = [
      createTransaction({ id: 'buy-1', date: '2024-04-10', type: 'BUY', quantity: 10, price_gbp: 100, value_gbp: 1000 }),
      createTransaction({ id: 'sell-1', date: '2024-10-30', type: 'SELL', quantity: 10, price_gbp: 500, value_gbp: 5000 }), // £4,000 gain
    ]

    const result = calculateCGT(transactions)
    const summary = result.taxYearSummaries.find(s => s.taxYear === '2024/25')

    expect(summary!.hasRateChange).toBe(true)
    expect(summary!.requiresAdjustment).toBe(true)
    expect(summary!.gainsAfterRateChange).toBeGreaterThan(0)
    expect(summary!.gainsBeforeRateChange).toBe(0)
  })
})
```

---

## Action Items Summary

### Must Fix Before Merge
1. ✅ Implement `requiresAdjustment` logic in `calculateRateChangeSplit()`
2. ✅ Add `requiresAdjustment?: boolean` to `TaxYearSummary` type
3. ✅ Update UI to show conditional messages based on `requiresAdjustment`
4. ✅ Improve messaging to explain basic vs higher rates (10%/20% vs 18%/24%)
5. ✅ Add clear instructions mentioning Box 51 and HMRC calculator
6. ✅ Add test cases for all edge cases

### Nice to Have
- Update PDF with explanatory note about Box 51 evidence
- Consider adding direct link to HMRC calculator in multiple places

---

## Files to Modify

1. **`src/lib/cgt/engine.ts`** - Update `calculateRateChangeSplit()` function
2. **`src/types/cgt.ts`** - Add `requiresAdjustment` field to `TaxYearSummary`
3. **`src/components/TaxYearSummary.tsx`** - Replace rate change section with conditional logic
4. **`src/components/PDFExport.tsx`** - Add explanatory note (optional)
5. **`src/lib/cgt/__tests__/engine.test.ts`** - Add new test cases

---

## Key Learnings

### About SA108 Form Structure
- The form does NOT have separate before/after fields
- Box 51 is where adjustments go
- SA system defaults to OLD rates (10%/20%) for entire year
- Any disposal on/after 30 Oct requires adjustment if gains > £3,000

### About HMRC Calculator
- Official calculator: https://www.gov.uk/guidance/work-out-your-capital-gains-tax-adjustment-for-the-2024-to-2025-tax-year
- Required for anyone with disposals on/after 30 Oct and gains > £3k
- Result must be saved and attached to SA return
- Failure to include adjustment can result in penalties

### About User Requirements
- App should provide the data (split figures)
- App should guide users to HMRC calculator
- App should NOT replicate HMRC calculator functionality
- PDF export serves as evidence attachment

---

## References

- [How to Fill In Box 51 for Crypto Gains (2025)](https://cryptobooks.tax/en/blog/box-51-crypto-tax-uk-cgt)
- [UK Capital Gains Tax 2024/25: Reporting Adjustments](https://accountingscouts.co.uk/news/capital-gains-tax-adjustment-2024-25-uk/)
- [CGT adjustment may be needed to 2024/25 tax returns | ICAEW](https://www.icaew.com/insights/tax-news/2025/mar-2025/cgt-adjustment-may-be-needed-to-2024-25-tax-returns)
- [HMRC CGT Adjustment Calculator](https://www.gov.uk/guidance/work-out-your-capital-gains-tax-adjustment-for-the-2024-to-2025-tax-year)
- [How to navigate the mid-year CGT rate changes | AccountingWEB](https://www.accountingweb.co.uk/tax/hmrc-policy/how-to-navigate-the-mid-year-cgt-rate-changes)
