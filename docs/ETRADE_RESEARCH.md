# E-Trade CSV Format Research

**Last Updated**: 2025-10-26
**Status**: Research phase - exact CSV format not yet confirmed

## Overview

This document contains research findings about E-Trade's CSV export formats for implementing an E-Trade parser in the Capital Gains Tax Visualiser.

## E-Trade Export Types

E-Trade provides several types of CSV/Excel exports:

### 1. Transaction History CSV (`DownloadTxnHistory.csv`)

**Primary export format** for transaction history.

**How to Export**:
1. Log into E-Trade account
2. Navigate to: **Trading & Portfolios** > **Transaction History**
3. Time Period: Select **Custom** from dropdown
4. Enter **From** and **To** dates
5. Ensure **"Non-Cash Transactions"** is enabled
6. Ensure **"Sweep Activities"** is disabled
7. Click **Download** button
8. Select **"Spreadsheet Format Excel"** from format dropdown
9. File downloads as `DownloadTxnHistory.csv`

**Contents**:
- Executed trades
- Deposits
- Withdrawals
- Dividends
- Option expirations and assignments

**Known Limitations**:
- No timestamps (date only)
- Option expirations/assignments may not clearly indicate buy vs. sell

### 2. Gains & Losses Files

Multiple formats available from different sections:

#### Collapsed View (`gainlossdownload.csv`)
- Downloaded from **Gains & Losses** tab
- Available in CSV format

#### Excel Format (`G&L_Collapsed.xlsx`)
**Confirmed Fields** (from GitHub gist analysis):
- **Field 2**: Symbol (e.g., "AAPL")
- **Field 19**: Adjusted Gain/Loss (numerical value)
- **Field 21**: Capital Gains Status ("Short Term" or "Long Term")

**File Structure**:
- First 3 rows contain headers/metadata (must skip when parsing)
- Use `tail -n +4` to skip header rows

#### Tax Documents (`tradesdownload.csv`)
- Downloaded from: **Statements & Records** > **Tax Documents**
- Contains tax-related trade information

### 3. Tax Documents (`TaxableGLDownload.csv`)

- Contains Form 1099-B information
- Available from tax documents section

### 4. Positions CSV

**Confirmed Columns**:
- `Symbol`
- `Price Paid $`
- `Qty #`

**How to Export**:
- Downloaded from positions/holdings view
- Represents current holdings, not transaction history

## Format Variability

**Important**: E-Trade's CSV format has changed over time:
- Different formats existed for 2008, 2009, 2010
- Current format may differ from historical documentation
- No official API or format specification published by E-Trade

## Known Field Information

From various sources, E-Trade transaction exports likely contain:

### Probable Fields (not confirmed):
- Date (no time component)
- Symbol / Ticker
- Action / Transaction Type
- Quantity / Shares
- Price
- Amount / Value
- Description
- Account information

### Transaction Types Observed:
- Buy / Sell trades
- Dividends
- Deposits / Withdrawals
- Interest
- Fees
- Option exercises
- Option expirations
- Option assignments

## Research Sources

### Documentation Found:
1. **TradeLog Software Support**: E-Trade CSV import instructions
   - URL: https://support.tradelogsoftware.com/hc/en-us/articles/115004433374
   - Focus: How to download, not format details

2. **Wingman Tracker Help**: E-Trade CSV instructions
   - URL: https://help.wingmantracker.com/article/3201-etrade-trades-csv-instructions
   - Focus: Export process only

3. **TradingDiary Pro**: E-Trade CSV import guide
   - URL: https://webhelp.tradingdiarypro.com/import_transactions_csv.htm
   - Confirms file name: `DownloadTxnHistory.csv`

4. **GitHub Gist**: Capital gains calculation script
   - URL: https://gist.github.com/dantonnoriega/fa0d3cdbb0b4012f217262c1bf405132
   - Reveals G&L Excel file structure (fields 2, 19, 21)

### Third-Party Software Compatibility:
E-Trade CSVs are accepted by:
- TradeLog
- TurboTax (via TXF Express)
- H&R Block
- Wingman Tracker
- TradingDiary Pro
- Chartlog
- TraderFyles

This suggests standardized export format, but exact specifications not publicly documented.

## What We Don't Know

### Critical Missing Information:
1. **Exact column headers** for `DownloadTxnHistory.csv`
2. **Column order** and delimiter (likely comma)
3. **Date format** (likely MM/DD/YYYY based on US broker patterns)
4. **Currency representation** (likely USD as default, unclear if multi-currency)
5. **Action/Type values** (exact strings for buy, sell, dividend, etc.)
6. **Fee handling** (separate column vs. included in amount)
7. **Split/merger handling**
8. **Corporate action representation**

### Unclear Aspects:
- How options are represented
- How multi-leg options trades are structured
- Fractional share handling
- Stock dividends vs. cash dividends differentiation

## Recommendations for Implementation

### Option 1: User-Provided Sample File (Preferred)
**Next Steps**:
1. Request sample E-Trade CSV from user
2. Examine actual column structure
3. Create parser based on real format
4. Add anonymized sample to `test-data/`

**Pros**:
- Accurate implementation
- Can test against real data
- Avoids guesswork

### Option 2: Reverse Engineering
**Next Steps**:
1. Research open-source tax software that parses E-Trade CSVs
2. Examine their parsing logic
3. Infer expected format

**Potential Repositories**:
- Look for tax calculation tools on GitHub
- Check trading journal software
- Search for portfolio trackers with E-Trade support

**Cons**:
- May not find source code
- May be outdated

### Option 3: Skeleton Implementation
**Next Steps**:
1. Create parser stub with placeholder detection
2. Document what fields we expect based on research
3. Wait for sample file to complete implementation

**Structure**:
```typescript
// src/lib/parsers/etrade.ts
export function normalizeETradeTransactions(
  rows: Record<string, unknown>[],
  fileId: string
): GenericTransaction[] {
  // TODO: Implement when format confirmed
  throw new Error('E-Trade format not yet confirmed');
}
```

## Implementation Checklist

When format is confirmed:

- [ ] Add `ETRADE` to `BrokerType` enum (`src/types/broker.ts`)
- [ ] Create detection function in `src/lib/brokerDetector.ts`
  - [ ] Identify unique headers for E-Trade
  - [ ] Add to detection chain (priority order TBD)
- [ ] Create parser in `src/lib/parsers/etrade.ts`
  - [ ] Parse date format
  - [ ] Map action types to `TransactionType`
  - [ ] Handle currency (USD assumed?)
  - [ ] Parse amounts (remove $, commas)
  - [ ] Generate unique IDs
- [ ] Add tests in `src/lib/parsers/__tests__/etrade.test.ts`
- [ ] Add sample CSV to `test-data/etrade-transactions.csv`
- [ ] Update `src/lib/csvParser.ts` routing logic
- [ ] Add E2E test in `e2e/import.spec.ts`

## Notes for Parser Development

Based on existing Schwab/Trading212 patterns:

### ID Generation
Use standard pattern: `${fileId}-${rowIndex}`

### Date Parsing
E-Trade likely uses US date format:
- Expected: `MM/DD/YYYY`
- Convert to ISO: `YYYY-MM-DD`

### Currency Handling
- Assume USD if currency field not present
- Strip `$` symbols and commas
- Handle negative values (fees, sells)

### Action Mapping
Will need to map E-Trade-specific action strings to:
```typescript
enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  DIVIDEND = 'DIVIDEND',
  FEE = 'FEE',
  INTEREST = 'INTEREST',
  TRANSFER = 'TRANSFER',
  TAX = 'TAX'
}
```

### Source Name
User-facing broker name: `"E-Trade"` or `"E*TRADE"`

## Related Files in Project

- `src/lib/parsers/schwab.ts` - Similar US broker, good reference
- `src/lib/parsers/trading212.ts` - Different format but good pattern
- `src/lib/brokerDetector.ts` - Detection chain priority
- `test-data/` - Sample CSV storage

## Next Actions

1. **Request sample E-Trade CSV** from user or E-Trade account holder
2. **Analyze actual format** once file obtained
3. **Update this document** with confirmed field structure
4. **Implement parser** following project patterns
5. **Add comprehensive tests** with real data examples

---

## Appendix: Research Search Queries Used

- "E-Trade CSV export format transaction history example"
- "E-Trade brokerage download transactions CSV file structure"
- "E-Trade export format headers columns sample data"
- site:github.com E-Trade CSV parser
- "E-Trade" CSV "TransactionDate" "Symbol" "Quantity" "Price"
- E-Trade "gainlossdownload.csv" OR "tradesdownload.csv"
- E-Trade brokerage statement CSV fields

**Result**: No publicly available documentation with exact CSV format specifications found.
