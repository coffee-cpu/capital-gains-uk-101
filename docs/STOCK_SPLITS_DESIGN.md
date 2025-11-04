# Stock Splits Design Document

**Version**: 1.0
**Date**: 2025-11-04
**Status**: Draft

## Table of Contents

1. [Overview](#overview)
2. [HMRC Tax Treatment](#hmrc-tax-treatment)
3. [Data Sources](#data-sources)
4. [Data Model](#data-model)
5. [Normalization Strategy](#normalization-strategy)
6. [Bed-and-Breakfast Matching](#bed-and-breakfast-matching)
7. [Section 104 Pool](#section-104-pool)
8. [Implementation Plan](#implementation-plan)
9. [Examples](#examples)
10. [Edge Cases](#edge-cases)

---

## Overview

This document describes how the Capital Gains Tax Visualiser handles **stock splits** and other share reorganisations in accordance with HMRC rules.

### Key Principles

1. **Broker-only data**: No external API calls for split information
2. **Privacy-first**: All processing happens client-side
3. **HMRC compliance**: Follow TCGA92/S127 statutory treatment
4. **Quantity normalization**: Convert all shares to a common base for matching

---

## HMRC Tax Treatment

### TCGA92/S127 - Share Reorganisations

Stock splits are treated as **share reorganisations** under TCGA92/S127, which establishes two "statutory fictions":

1. **No Disposal**: You're treated as NOT having disposed of your original shares
2. **Same Asset**: Original shares and new shares are treated as the **same asset acquired at the same time**

### Key Tax Implications

- Stock splits are **not taxable events**
- New shares inherit the **acquisition date** of the original shares
- Cost basis is **spread proportionally** across the new total quantity
- Split shares **do NOT trigger bed-and-breakfast matching** (CG51560)

### Example (HMRC Guidance)

> "A disposal of shares followed by a company reorganisation (such as a rights issue or bonus issue) to which TCGA92/S127 applies...with the result that the additional shares are not treated as acquired within the 30 days following the disposal"
>
> — HMRC CG51560

---

## Data Sources

### Broker-Only Approach

**Primary source**: CSV files from brokers (Trading 212, Charles Schwab, Freetrade, etc.)

**Rationale**:
- ✅ Maintains privacy (no external API calls)
- ✅ Broker's official record matches user's account
- ✅ Handles fractional shares correctly
- ✅ Works offline
- ✅ No API costs or rate limits

### Broker Support Status

| Broker | Split Detection | Format |
|--------|----------------|--------|
| **Trading 212** | ✅ Yes | `"Stock Split"` action in CSV |
| **Charles Schwab** | ✅ Yes | `"Stock Split"` action in CSV |
| **Schwab Equity Awards** | ⚠️ TBD | May need investigation |
| **Freetrade** | ❌ No | Not in current CSV format |
| **Generic CSV** | ✅ Yes | User can specify `STOCK_SPLIT` type |

### Fallback: Generic CSV Import

For brokers that don't export split events, users can create and import a Generic CSV file with split transactions:

**Example Generic CSV** (`my-splits.csv`):
```csv
date,type,symbol,ratio
2024-06-10,STOCK_SPLIT,NVDA,10:1
2022-08-25,STOCK_SPLIT,TSLA,3:1
2020-08-31,STOCK_SPLIT,AAPL,4:1
```

**Field Descriptions:**
- `date`: Split effective date (YYYY-MM-DD)
- `type`: Must be `STOCK_SPLIT`
- `symbol`: Stock ticker
- `ratio`: Split ratio in format `new:old` (e.g., "2:1" for 2-for-1 split, "1:10" for reverse split)

**Ratio Examples:**
- `2:1` = 2-for-1 split (shares double)
- `10:1` = 10-for-1 split (shares multiply by 10)
- `1:10` = 1-for-10 reverse split (shares divide by 10)

The system automatically calculates the quantity adjustment based on your holdings at the split date.

---

## Data Model

### TransactionType Extension

Add new transaction type to `src/types/transaction.ts`:

```typescript
export const TransactionType = z.enum([
  "BUY",
  "SELL",
  "DIVIDEND",
  "FEE",
  "INTEREST",
  "TRANSFER",
  "TAX",
  "STOCK_SPLIT",     // ← NEW
]);
```

### StockSplit Data Structure

```typescript
/**
 * Represents a stock split event
 */
export interface StockSplitEvent {
  id: string;
  date: string;              // ISO format: YYYY-MM-DD
  symbol: string;            // e.g., "NVDA", "AAPL"
  ratio: string;             // e.g., "2:1", "10:1", "1:10" (reverse split)
  ratioMultiplier: number;   // e.g., 2.0, 10.0, 0.1
  source: string;            // e.g., "Trading 212", "Generic CSV", "Charles Schwab"

  // For audit trail
  originalTransaction?: GenericTransaction;
}

/**
 * Parse split ratio string to multiplier
 * @example "2:1" → 2.0 (2-for-1 split, shares double)
 * @example "10:1" → 10.0 (10-for-1 split, shares 10x)
 * @example "1:10" → 0.1 (1-for-10 reverse split, shares /10)
 */
function parseRatioMultiplier(ratio: string): number {
  const [newShares, oldShares] = ratio.split(':').map(Number);
  return newShares / oldShares;
}
```

### EnrichedTransaction Extension

Add split normalization fields to the existing `EnrichedTransaction` schema:

```typescript
export const EnrichedTransactionSchema = GenericTransactionSchema.extend({
  // Existing FX enrichment fields
  fx_rate: z.number(),
  price_gbp: z.number().nullable(),
  value_gbp: z.number().nullable(),
  fee_gbp: z.number().nullable(),
  fx_source: z.string(),
  fx_error: z.string().nullable().optional(),

  // Existing CGT fields
  tax_year: z.string(),
  gain_group: z.enum(['SAME_DAY', '30_DAY', 'SECTION_104', 'NONE']),
  match_groups: z.array(z.string()).optional(),

  // NEW: Split normalization fields
  split_adjusted_quantity: z.number().nullable().describe(
    'Quantity adjusted for all stock splits that occurred after this transaction'
  ),
  split_adjusted_price: z.number().nullable().describe(
    'Price adjusted for all stock splits (price decreases when shares increase)'
  ),
  split_multiplier: z.number().default(1.0).describe(
    'Cumulative multiplier applied (e.g., 2.0 for 2:1 split, 10.0 for 10:1)'
  ),
  applied_splits: z.array(z.string()).default([]).describe(
    'Array of stock split transaction IDs that were applied to normalize this transaction'
  ),
})
```

**Why extend EnrichedTransaction?**
- ✅ Single source of truth for all computed transaction data
- ✅ FX conversion and split normalization happen at same enrichment stage
- ✅ Avoids parallel transaction type hierarchies
- ✅ Simpler to pass around (one type instead of two)

---

## Normalization Strategy

### The Problem

When a stock split occurs, transactions before and after the split use different "share units":

```
Before split: 1 share = £100 cost basis
After 2:1 split: 2 shares = £100 cost basis (£50 per share)
```

We need to **normalize all quantities to a common base** for matching.

### Solution: Forward Normalization

**Normalize everything to the MOST RECENT split-adjusted units**

#### Algorithm

```typescript
/**
 * Enriches transactions with split-adjusted quantities
 * This is part of the overall enrichment process (alongside FX conversion)
 */
function enrichWithSplitAdjustments(
  transactions: EnrichedTransaction[], // Already has FX data
  splits: StockSplitEvent[]
): EnrichedTransaction[] {

  // Sort splits by date
  const sortedSplits = splits.sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return transactions.map(tx => {
    // Find all splits that occurred AFTER this transaction
    const appliedSplits = sortedSplits.filter(
      split => split.date > tx.date && split.symbol === tx.symbol
    );

    // Calculate cumulative multiplier
    const multiplier = appliedSplits.reduce(
      (mult, split) => mult * split.ratioMultiplier,
      1.0
    );

    return {
      ...tx,
      split_adjusted_quantity: tx.quantity ? tx.quantity * multiplier : null,
      split_adjusted_price: tx.price ? tx.price / multiplier : null,
      split_multiplier: multiplier,
      applied_splits: appliedSplits.map(s => s.id)
    };
  });
}
```

---

## Bed-and-Breakfast Matching

### HMRC Rule Reminder

Split shares **do NOT count as acquisitions** for the 30-day bed-and-breakfast rule (TCGA92/S127).

### Implementation

```typescript
/**
 * Match disposals with acquisitions using 30-day bed-and-breakfast rule
 * Excludes STOCK_SPLIT transactions from matching per TCGA92/S127
 * Uses split-adjusted quantities for matching
 */
function applyBedAndBreakfastRule(
  disposal: EnrichedTransaction,
  acquisitions: EnrichedTransaction[]
): BedAndBreakfastMatch[] {

  const matches: BedAndBreakfastMatch[] = [];
  let remainingQuantity = disposal.split_adjusted_quantity || 0;

  // Search next 30 days
  const endDate = addDays(disposal.date, 30);

  const eligibleAcquisitions = acquisitions.filter(acq =>
    acq.symbol === disposal.symbol &&
    acq.date > disposal.date &&
    acq.date <= endDate &&
    acq.type !== "STOCK_SPLIT" && // ← EXCLUDE SPLITS
    acq.type === "BUY"
  );

  // Sort by date (earliest first)
  eligibleAcquisitions.sort((a, b) => a.date.localeCompare(b.date));

  for (const acq of eligibleAcquisitions) {
    if (remainingQuantity <= 0) break;

    const matchedQuantity = Math.min(
      remainingQuantity,
      acq.split_adjusted_quantity || 0 // ← Use split-adjusted quantities
    );

    matches.push({
      disposalId: disposal.id,
      acquisitionId: acq.id,
      matchedQuantity,      // In split-adjusted units
      costBasis: (acq.split_adjusted_price || 0) * matchedQuantity,
      proceeds: (disposal.split_adjusted_price || 0) * matchedQuantity,
      gain: calculateGain(...)
    });

    remainingQuantity -= matchedQuantity;
  }

  return matches;
}
```

### Example Walkthrough

#### Scenario

```
Day 1:  SELL 100 shares @ £20 each
Day 10: STOCK_SPLIT 2:1
Day 20: BUY 200 shares @ £10 each
```

#### Step 1: Normalize Quantities

| Date | Event | Original Qty | split_multiplier | split_adjusted_quantity | split_adjusted_price |
|------|-------|--------------|------------------|-------------------------|----------------------|
| Day 1 | SELL | 100 | 2.0 (split after) | **200** | £10 |
| Day 10 | SPLIT | N/A | - | - | - |
| Day 20 | BUY | 200 | 1.0 (no splits after) | **200** | £10 |

#### Step 2: Apply Bed-and-Breakfast

- Disposal on Day 1: **200 split-adjusted shares**
- Acquisition on Day 20: **200 split-adjusted shares** (SPLIT excluded!)
- Match: **200 shares** at £10 cost basis

#### Step 3: Calculate Gain

```
Proceeds: 200 shares × £10 = £2,000
Cost:     200 shares × £10 = £2,000
Gain:     £0
```

**Result**: All 200 shares are matched under bed-and-breakfast (representing the original 100 pre-split shares sold).

---

## Section 104 Pool

### Pool Adjustment for Splits

When a split occurs, adjust the Section 104 pool:

```typescript
/**
 * Apply stock split to Section 104 pool
 */
function applySpitToPool(
  pool: Section104Pool,
  split: StockSplitEvent
): Section104Pool {

  // Quantity increases by ratio
  const newQuantity = pool.quantity * split.ratioMultiplier;

  // Cost basis remains the SAME (key HMRC rule!)
  const newCostBasis = pool.totalCostBasis;

  // Average cost per share decreases
  const newAverageCost = newCostBasis / newQuantity;

  return {
    ...pool,
    quantity: newQuantity,
    totalCostBasis: newCostBasis,
    averageCost: newAverageCost,
    events: [
      ...pool.events,
      {
        date: split.date,
        type: "SPLIT",
        ratio: split.ratio,
        quantityBefore: pool.quantity,
        quantityAfter: newQuantity,
        costBasis: newCostBasis
      }
    ]
  };
}
```

### Example

```
Before Split (2:1):
  Quantity: 1,000 shares
  Cost Basis: £10,000
  Average Cost: £10/share

After Split:
  Quantity: 2,000 shares
  Cost Basis: £10,000 (UNCHANGED)
  Average Cost: £5/share
```

---

## Implementation Plan

### Phase 1: Data Model & Parsing

**Files to modify:**
- `src/types/transaction.ts` - Add `STOCK_SPLIT` type
- `src/lib/parsers/trading212.ts` - Parse split events
- `src/lib/parsers/schwab.ts` - Parse split events
- `src/lib/parsers/generic.ts` - Support split type

**Tasks:**
1. ✅ Add `TransactionType.STOCK_SPLIT` to schema
2. ✅ Create `StockSplitEvent` interface
3. ✅ Update parser detection logic
4. ✅ Update Generic CSV parser to handle `ratio` field for STOCK_SPLIT types
5. ✅ Write parser unit tests

**Generic CSV Parser Notes:**
- When `type === "STOCK_SPLIT"`, parse the `ratio` field (e.g., "10:1")
- Calculate `ratioMultiplier` using `parseRatioMultiplier(ratio)`
- Set `quantity` to `null` initially (will be calculated during normalization based on holdings)
- Store `ratio` string in transaction metadata for display/audit purposes

### Phase 2: Normalization Engine

**Files to modify:**
- `src/types/transaction.ts` - Add split fields to `EnrichedTransactionSchema`
- `src/lib/splitEnricher.ts` (new) - Split adjustment logic

**Tasks:**
1. ✅ Add split fields to `EnrichedTransactionSchema`
2. ✅ Implement `parseRatioMultiplier()`
3. ✅ Implement `enrichWithSplitAdjustments()`
4. ✅ Integrate into existing enrichment pipeline
5. ✅ Write normalization tests (including edge cases)

### Phase 3: CGT Engine Updates

**Files to modify:**
- `src/lib/cgtEngine.ts` (when created)

**Tasks:**
1. ✅ Update bed-and-breakfast logic to use normalized quantities
2. ✅ Exclude `STOCK_SPLIT` from acquisition matching
3. ✅ Update Section 104 pool calculations
4. ✅ Write integration tests

### Phase 4: UI/UX

**Files to modify:**
- `src/components/TransactionList.tsx` - Display split events

**Tasks:**
1. ✅ Show split events in transaction list
2. ✅ Add visual indicator for split-adjusted quantities
3. ✅ Display split ratio and source in transaction details

---

## Examples

### Example 1: Simple 2:1 Split

**Timeline:**
```
2023-01-10: BUY 500 shares @ £40 = £20,000
2023-06-15: STOCK_SPLIT 2:1
2024-02-20: SELL 1,000 shares @ £22 = £22,000
```

**Split-Adjusted:**
```
2023-01-10: BUY 1,000 shares (split-adjusted) @ £20 = £20,000
2024-02-20: SELL 1,000 shares @ £22 = £22,000
```

**CGT Calculation:**
```
Proceeds: £22,000
Cost:     £20,000
Gain:     £2,000
```

---

### Example 2: Split During Bed-and-Breakfast Window

**Timeline:**
```
2024-01-05: SELL 100 shares @ £50 = £5,000
2024-01-15: STOCK_SPLIT 2:1
2024-01-25: BUY 200 shares @ £26 = £5,200
```

**Split-Adjusted:**
```
2024-01-05: SELL 200 shares (split-adjusted) @ £25 = £5,000
2024-01-25: BUY 200 shares @ £26 = £5,200
```

**Bed-and-Breakfast Match:**
```
All 200 shares matched (100 pre-split equivalent)
Proceeds: £5,000
Cost:     £5,200
Loss:     £200
```

---

### Example 3: Multiple Splits

**Timeline:**
```
2020-01-01: BUY 100 shares @ £100 = £10,000
2020-06-01: STOCK_SPLIT 2:1
2021-06-01: STOCK_SPLIT 3:1
2024-01-01: SELL 600 shares @ £20 = £12,000
```

**Split Adjustment:**
```
Cumulative multiplier: 2 × 3 = 6
Original 100 shares → 600 shares (split-adjusted)
Original £100/share → £16.67/share (split-adjusted)
```

**CGT Calculation:**
```
Proceeds: £12,000
Cost:     £10,000 (original cost basis preserved!)
Gain:     £2,000
```

---

### Example 4: Reverse Split (1:10)

**Timeline:**
```
2023-01-01: BUY 1,000 shares @ £1 = £1,000
2023-06-01: STOCK_SPLIT 1:10 (reverse)
2024-01-01: SELL 100 shares @ £12 = £1,200
```

**Split-Adjusted:**
```
Multiplier: 1/10 = 0.1
Original 1,000 shares → 100 shares (split-adjusted)
Original £1/share → £10/share (split-adjusted)
```

**CGT Calculation:**
```
Proceeds: £1,200
Cost:     £1,000
Gain:     £200
```

---

## Edge Cases

### 1. Fractional Shares

**Scenario:** Stock split creates fractional shares (e.g., 1.5 shares after 3:2 split)

**Solution:** Support decimal quantities in `split_adjusted_quantity` field

```typescript
// 3:2 split on 100 shares
const multiplier = 3 / 2; // 1.5
const split_adjusted_quantity = 100 * 1.5; // 150 shares
```

---

### 2. Multiple Splits Between Buy and Sell

**Scenario:**
```
BUY 100 shares
SPLIT 2:1
SPLIT 3:1
SELL 600 shares
```

**Solution:** Apply cumulative multiplier
```typescript
const cumulativeMultiplier = 2 * 3; // = 6
const split_adjusted_quantity = 100 * 6; // = 600
```

---

### 3. Split on Day of Sale (Same-Day Rule)

**Scenario:**
```
2024-01-10: SELL 100 shares
2024-01-10: STOCK_SPLIT 2:1
2024-01-10: BUY 200 shares
```

**Solution:**
- Split is **not** an acquisition (TCGA92/S127)
- Same-day rule applies to the BUY only
- Normalize quantities for matching

---

### 4. Partial Sale After Split

**Scenario:**
```
BUY 100 shares @ £100 = £10,000
SPLIT 2:1 → now 200 shares
SELL 50 shares @ £55 = £2,750
```

**Calculation:**
```
Cost basis per share: £10,000 / 200 = £50
Proceeds: £2,750
Cost: 50 × £50 = £2,500
Gain: £250
```

---

### 5. Broker Doesn't Report Split

**Scenario:** User imports Freetrade CSV which doesn't include split events

**Solution:**
1. Detect quantity discrepancy (portfolio shows more shares than buys)
2. Show warning: "Potential unreported stock split detected for SYMBOL"
3. Suggest: "Create a Generic CSV file with STOCK_SPLIT entries and import it"
4. Provide link to Generic CSV format documentation

---

### 6. Split Between Different Brokers

**Scenario:**
```
Broker A CSV: BUY 100 shares (pre-split)
[Transfer to Broker B]
Broker B CSV: SELL 200 shares (post-split)
```

**Solution:**
- User creates a Generic CSV file with the split event
- Import Generic CSV alongside broker CSVs
- System merges all transactions chronologically

---

### 7. Dividend Before and After Split

**Scenario:**
```
Hold 100 shares
Receive £100 dividend (£1/share)
SPLIT 2:1
Hold 200 shares
Receive £100 dividend (£0.50/share)
```

**Solution:** Dividends are independent events, no normalization needed (dividends are income, not CGT events)

---

## References

- **HMRC CG51560**: Share identification rules (bed-and-breakfast)
- **HMRC CG51805**: Effect of TCGA92/S127 (reorganisations)
- **TCGA92/S127**: Share reorganisation statutory treatment
- **HS285**: HMRC helpsheet on share reorganisations

---

## Future Enhancements

### Optional: External API Validation (Phase 5)

**Goal:** Warn users if broker data might be missing splits

**Implementation:**
1. Add opt-in toggle: "Validate against external split data"
2. Privacy warning: "This will send ticker symbols to [provider]"
3. Use Alpha Vantage or Financial Modeling Prep free tier
4. Show warning if detected splits don't match broker imports

**UI Mockup:**
```
⚠️ Warning: External data shows NVDA had a 10:1 split on 2024-06-10,
but this split was not found in your imported transactions.

[Add Split Manually] [Ignore Warning]
```

### Optional: ISIN/Ticker Mapping (Phase 6)

**Problem:** Different brokers use different identifiers (ISIN vs ticker)

**Solution:** Maintain ISIN ↔ Ticker mapping table

```typescript
{
  "US67066G1040": "NVDA",  // NVIDIA
  "US0378331005": "AAPL",  // Apple
  // ...
}
```

Store in `src/lib/symbolMapping.ts` or IndexedDB.

---

## Testing Strategy

### Unit Tests

**File:** `src/lib/__tests__/splitEnricher.test.ts`

Test cases:
- ✅ Parse ratio multipliers (2:1, 10:1, 1:10)
- ✅ Enrich transactions with single split
- ✅ Enrich transactions with multiple splits
- ✅ Reverse splits
- ✅ Fractional shares
- ✅ Split-adjusted quantities match original quantity × multiplier
- ✅ Split-adjusted price = original price / multiplier

### Integration Tests

**File:** `src/lib/__tests__/cgtEngineWithSplits.test.ts`

Test cases:
- ✅ Bed-and-breakfast across split
- ✅ Section 104 pool adjustment
- ✅ Same-day rule with split on same day
- ✅ Multiple buys/sells across splits

### E2E Tests

**File:** `e2e/stockSplits.spec.ts`

Test cases:
- ✅ Import broker CSV with split events
- ✅ Import Generic CSV with split events
- ✅ CGT calculation with splits
- ✅ Export PDF with split details

---

## Open Questions

1. **Q:** Should we show original (pre-split) and normalized quantities in the UI?
   **A:** Yes - show both for transparency. Display format: `"200 shares (100 pre-split)"`

2. **Q:** How to handle splits for symbols with no cost basis (e.g., free shares)?
   **A:** Cost basis of £0 is valid. Apply split normally: £0 / 2 = £0.

3. **Q:** What if user imports same split from multiple files (e.g., both Generic CSV and broker CSV)?
   **A:** Deduplicate by date + symbol + ratio. Show warning if different ratios detected for same date+symbol.

4. **Q:** How does the system calculate quantity adjustment from split ratio?
   **A:** System tracks holdings chronologically. At split date, applies ratio multiplier to current holdings. For 2:1 split of 100 shares: 100 × 2 = 200 (100 new shares created).

---

**End of Document**
