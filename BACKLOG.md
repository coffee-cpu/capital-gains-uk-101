# Backlog

Feature requests, improvements, and technical debt items for future consideration.

## Features

### Stock Split Handling

**Status:** Needs investigation

**Problem:**
Currently, stock splits from Trading 212 are mapped to the `FEE` transaction type as a workaround (see `src/lib/parsers/trading212.ts:54`). This is not semantically correct and may cause issues:
- Stock splits don't affect capital gains but do affect cost basis calculations
- They should adjust the quantity and price of existing holdings proportionally
- HMRC requires tracking the adjusted cost basis after splits

**Questions to resolve:**
1. Should we add a new transaction type `STOCK_SPLIT`?
2. How should stock splits interact with Section 104 pool calculations?
3. Do we need to retroactively adjust quantities and prices of previous acquisitions?
4. What information do we need to track? (split ratio, pre/post-split quantities)
5. How do different brokers report stock splits in their CSVs?

**Related:**
- Trading 212 parser (uses `stock split` action)
- CGT engine (may need to handle split adjustments)
- Transaction schema (may need new type or fields)

**References:**
- HMRC guidance on share reorganisations and capital gains
- Trading 212 CSV format documentation
