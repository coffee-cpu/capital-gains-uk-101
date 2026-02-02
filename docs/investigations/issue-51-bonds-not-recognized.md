# Issue #51 Investigation: Bonds Sale Not Recognized

## Summary

Schwab treasury bond transactions ("Full Redemption", "Full Redemption Adj") are not
recognized by the Schwab parser. They fall through to the `UNKNOWN` type and are
excluded from CGT calculations.

## Root Cause

The `mapSchwabAction()` function in `src/lib/parsers/schwab.ts:193-240` has no
handling for bond-related Schwab actions. The action mapping chain covers:

- Options actions (buy/sell to open/close, assigned, expired)
- Stock actions (buy, sell, sell short, stock plan activity)
- Stock splits
- Dividends (any action containing "dividend")
- Interest (any action containing "interest")
- Tax (any action containing "tax")
- Transfers (wire, transfer, journal, moneylink)
- Fees

Any unrecognized action falls to the `else` clause at line 233 and is mapped to
`TransactionType.UNKNOWN` with a console warning.

**Bond actions that fall through:**
- `"Full Redemption"` → no keyword match → `UNKNOWN`
- `"Full Redemption Adj"` → no keyword match → `UNKNOWN`

## Why UNKNOWN Transactions Are Excluded from CGT

The CGT engine in `src/lib/cgt/utils.ts` uses `isAcquisition()` and `isDisposal()`
to determine which transactions participate in matching. `UNKNOWN` is not recognized
by either function, so these transactions are silently excluded from:

1. Same-day matching (TCGA92/S105(1))
2. 30-day bed-and-breakfast matching (TCGA92/S106A(5))
3. Section 104 pooling (TCGA92/S104)

The UI correctly signals this: UNKNOWN transactions display with an amber badge,
reduced opacity, and a tooltip explaining they are not included in CGT calculations.

## User's Specific Scenario

From the issue, the user has:
- **Buy**: 01/02/2024 — 50,000 bonds at $96.7317/unit = $48,434.17
- **Maturity**: 10/15/2024 — Two lines: "Full Redemption Adj" + "Full Redemption" returning $50,000

The "Buy" action is correctly parsed as `BUY`. The two maturity lines are both
mapped to `UNKNOWN`, so no CGT disposal is recorded.

### Why Two Transactions?

Schwab reports bond maturities as two separate CSV rows:
- **"Full Redemption Adj"**: Likely an adjustment entry (e.g., accrued interest
  settlement or price adjustment to par)
- **"Full Redemption"**: The actual principal redemption at face value

Together they represent the full maturity proceeds.

## Fix Considerations

### Simple Approach: Map "Full Redemption" to SELL

The most straightforward fix would be to add bond-related actions to `mapSchwabAction()`:

```typescript
} else if (actionLower === 'full redemption') {
  type = TransactionType.SELL
} else if (actionLower === 'full redemption adj') {
  // Adjustment entry — needs investigation into what this represents
  type = TransactionType.FEE // or TRANSFER, or a new type
}
```

This would cause the CGT engine to match the bond buy against the redemption.

### Complications

**1. UK Tax Treatment of Bonds**

UK CGT treatment of bonds is complex and differs significantly from equities:

- **UK Government gilts** are exempt from CGT (TCGA92/S115)
- **Qualifying corporate bonds (QCBs)** are generally exempt from CGT
- **US Treasury bonds** held by UK taxpayers: the discount-to-par gain may be
  treated as income (interest) rather than a capital gain, depending on circumstances
- **Non-qualifying corporate bonds**: subject to CGT but with special rules

Simply mapping "Full Redemption" to SELL would apply standard CGT matching rules
to instruments that may not be subject to CGT at all, potentially producing
misleading results.

**2. "Full Redemption Adj" Semantics**

Without more data samples, it's unclear what "Full Redemption Adj" represents:
- Accrued interest (should be income, not CGT)
- Settlement adjustment
- Price adjustment to par value

Mapping this incorrectly could double-count or misclassify proceeds.

**3. Quantity/Price Representation**

Bonds are typically quoted per $100 face value, not per unit. The user's data
shows 50,000 quantity at $96.7317 price, suggesting Schwab may report bonds
differently from stocks. The CGT engine assumes quantity × price = total, which
may not hold for bonds.

**4. Precedent: Interactive Brokers Skips Bonds**

The Interactive Brokers parser (`src/lib/parsers/interactiveBrokers.ts:323`) explicitly
detects and **skips** bond transactions via `isBondSymbol()`, acknowledging that
bonds require special handling beyond the current CGT engine's scope.

## Recommendation

**Short term**: Add "Full Redemption" and "Full Redemption Adj" to the action
mapping as `UNKNOWN` with a more descriptive note (e.g., "Bond redemption — not
yet supported for CGT"). This would at least give users a clearer signal than a
generic "unknown action" warning.

**Medium term**: Consider adding a `BOND_REDEMPTION` transaction type (or similar)
that the UI can display with appropriate messaging about bond CGT exemptions and
limitations, without running it through the CGT matching engine.

**Long term**: Proper bond support would require:
- Distinguishing gilt/QCB/non-QCB bonds
- Handling accrued interest separately from capital proceeds
- Supporting bond-specific pricing conventions
- Potentially a separate "bond CGT" calculation path

This is a significant feature and may be out of scope for the current tool, which
focuses on share transactions as stated in the project description.

## Files Referenced

- `src/lib/parsers/schwab.ts:193-240` — Action mapping (mapSchwabAction)
- `src/lib/cgt/utils.ts:79-125` — isAcquisition / isDisposal
- `src/lib/parsers/interactiveBrokers.ts:320-335` — Bond detection (isBondSymbol)
- `src/types/transaction.ts:13-33` — TransactionType enum
