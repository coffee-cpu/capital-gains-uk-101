# Freetrade CSV Format Research

**Last Updated**: 2025-10-28
**Status**: Research phase - exact CSV format not yet confirmed

## Overview

This document contains research findings about Freetrade's CSV export formats for implementing a Freetrade parser in the Capital Gains Tax Visualiser.

## About Freetrade

Freetrade is a UK-based commission-free trading app launched in 2016. Unlike US-based brokers, Freetrade operates under UK regulations and supports:
- General Investment Accounts (GIA)
- Individual Savings Accounts (ISA)
- Self-Invested Personal Pensions (SIPP)

**Key Characteristics**:
- Mobile-first platform (iOS/Android)
- UK investor base with GBP as primary currency
- Supports UK, US, and EU stocks
- Zero commission on basic trades

## Freetrade Export Types

### 1. Activity Feed CSV Export (Primary Format)

**Primary export format** for transaction history.

**How to Export**:
1. Open Freetrade mobile app (iOS/Android)
2. Navigate to: **Activity** tab (icon along bottom of screen)
3. Optional: Use **Calendar icon** to select custom date range
4. Tap **Share icon** (arrow pointing up) in top-right corner
5. Confirm by selecting **"All Activity"**
6. Export file to device

**File Name**: Unknown (likely `freetrade-activity.csv` or similar)

**Contents**:
- Top ups (deposits)
- Withdrawals
- Contract notes (executed trades)
- Free share contract notes (promotional shares)
- Dividends
- Interest
- Any returned deposits
- Tax relief (where applicable)
- Monthly statements
- SIPP-specific items (annual statement, wake up pack, pre-sale illustration)

**Known Limitations**:
- Account transfers from other providers NOT included (GIA, ISA or SIPP transfers)
- Tax reclaims for REITs in ISAs NOT included
- Corporate actions may NOT be included (stock splits, takeovers)
- Some entries may not be transactions (e.g., statement notifications)
- Cannot be filtered before export (all activity only)
- No official confirmation if suitable for tax return completion

### 2. Activity Statements (PDF/Alternative Format)

**Secondary format** requested from customer support.

**How to Request**:
- Contact Freetrade support directly
- Request activity statement for specific date range
- May include corporate actions not in CSV export

**Use Case**:
- When CSV export is insufficient for tax purposes
- When corporate actions (stock takeovers, mergers) need to be documented

## Format Variability

**Important Notes**:
- Freetrade launched CSV export feature in 2022 (feature request from 2018-2021)
- Format may have changed since initial release
- No official API or format specification published by Freetrade
- Community reports of parsing difficulties suggest inconsistent formatting

## Known Field Information

### Confirmed Columns:
Based on research, at least one column header is known:
- **Order Type** - Contains values like `AGGREGATE`

### Probable Fields (inferred from third-party tools):
Based on portfolio tracker import requirements:
- Date/Timestamp
- Ticker/Symbol
- Action/Type (Buy/Sell/Dividend/etc.)
- Quantity
- Price
- Fees
- Currency
- Total Amount

### Transaction Types Observed:
- Buy / Sell trades (contract notes)
- Dividends
- Interest payments
- Deposits (top ups)
- Withdrawals
- Free share awards (promotional)
- Tax relief (SIPP contributions)

## Research Sources

### Documentation Found:

1. **Freetrade Official Support**: CSV export instructions
   - URL: https://help.freetrade.io/en/articles/6627908-how-do-i-download-a-csv-export-of-my-activity-feed
   - Focus: How to export, not format details

2. **Freetrade Official Support**: CSV content information
   - URL: https://help.freetrade.io/en/articles/6627909-what-information-is-included-in-the-csv-download-of-my-activity-feed
   - Lists transaction types included/excluded

3. **Stock Portfolio Tracker**: Freetrade export guide
   - URL: https://stockportfoliotracker.app/how-to-download-stock-transactions/freetrade
   - Confirms export process only

4. **Simple Portfolio**: Freetrade export guide
   - URL: https://simpleportfolio.app/guides/freetrade-export/
   - Confirms export process only

### Third-Party Software Compatibility:

#### Open Source Tools:
1. **investir** (Python) - GitHub: tacgomes/investir
   - Analyzes Freetrade & Trading 212 CSV files
   - Calculates capital gains using HMRC rules (same-day, 30-day, Section 104)
   - Queries Yahoo Finance for corporate actions
   - **Most relevant for our use case** - implements HMRC tax rules for UK investors
   - Installed via: `python -m pip install git+https://github.com/tacgomes/investir`

2. **Export-To-Ghostfolio** (TypeScript/JavaScript) - GitHub: dickwolff/Export-To-Ghostfolio
   - Converts Freetrade CSV to Ghostfolio import format
   - May contain useful parsing logic

#### Commercial Tools:
- Sharesight (portfolio tracker)
- Stock Portfolio Tracker
- Simple Portfolio

This suggests a somewhat standardized export format, but exact specifications not publicly documented.

## What We Don't Know

### Critical Missing Information:
1. **Exact column headers** for Activity Feed CSV
2. **Column order** and delimiter (likely comma)
3. **Date format** (likely DD/MM/YYYY based on UK broker patterns, or ISO format)
4. **Time component** (whether timestamps include time or date only)
5. **Currency representation** (likely GBP default, unclear how multi-currency handled)
6. **Action/Type values** (exact strings for buy, sell, dividend, etc.)
7. **Fee handling** (separate column vs. included in amount, how zero fees represented)
8. **Price precision** (decimal places for fractional shares)
9. **Title/Description field** (free-form text describing activity)

### Unclear Aspects:
- How fractional shares are represented (US stocks support fractional ownership)
- Stock dividend vs. cash dividend differentiation
- Free share awards format (from promotional campaigns)
- DRIP (dividend reinvestment) handling
- Corporate action representation (if any)
- How ISA/GIA/SIPP accounts are distinguished (if at all)
- ISIN vs. ticker symbol usage
- Multi-currency transaction format (e.g., US stocks in USD)

## Implementation Checklist

When format is confirmed:

- [ ] Add `FREETRADE` to `BrokerType` enum (`src/types/broker.ts`)
- [ ] Create detection function in `src/lib/brokerDetector.ts`
  - [ ] Identify unique headers for Freetrade
  - [ ] Add to detection chain (priority order TBD)
  - [ ] Consider "Order Type" column as potential identifier
- [ ] Create parser in `src/lib/parsers/freetrade.ts`
  - [ ] Parse date format (likely DD/MM/YYYY or ISO)
  - [ ] Map action types to `TransactionType`
  - [ ] Handle currency (GBP vs. USD vs. EUR)
  - [ ] Parse amounts (handle £ symbol, commas, decimals)
  - [ ] Handle fractional shares
  - [ ] Generate unique IDs
  - [ ] Filter out non-transaction activities
- [ ] Add tests in `src/lib/parsers/__tests__/freetrade.test.ts`
- [ ] Add sample CSV to `test-data/freetrade-transactions.csv`
- [ ] Update `src/lib/csvParser.ts` routing logic
- [ ] Add E2E test in `e2e/import.spec.ts`

## Notes for Parser Development

Based on existing Schwab/Trading212 patterns and UK broker characteristics:

### ID Generation
Use standard pattern: `${fileId}-${rowIndex}`

### Date Parsing
Freetrade likely uses UK date format:
- Expected: `DD/MM/YYYY` or `YYYY-MM-DD` (ISO)
- May include time component: `DD/MM/YYYY HH:MM:SS`
- Convert to ISO: `YYYY-MM-DD`

**Important**: UK format reverses day/month compared to US brokers!

### Currency Handling
- Default currency: GBP (£)
- Multi-currency likely: USD ($), EUR (€) for international stocks
- Strip currency symbols: `£`, `$`, `€`
- Handle comma thousands separators: `1,234.56`
- Handle negative values (fees, withdrawals, sells)

**Possible currency field values**:
- `GBP`
- `USD`
- `EUR`

### Action Mapping
Will need to map Freetrade-specific action strings to:
```typescript
enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  DIVIDEND = 'DIVIDEND',
  FEE = 'FEE',
  INTEREST = 'INTEREST',
  TRANSFER = 'TRANSFER',  // Deposits/withdrawals
  TAX = 'TAX'
}
```

**Expected Freetrade action strings** (unconfirmed):
- Buy/Purchase → `BUY`
- Sell → `SELL`
- Dividend → `DIVIDEND`
- Interest → `INTEREST`
- Top up/Deposit → `TRANSFER`
- Withdrawal → `TRANSFER`
- Tax relief → `TAX`

### Non-Transaction Filtering
CSV includes non-transaction items:
- Monthly statements
- Contract note notifications
- Account opening activities

**Filter strategy**: Only process rows with recognized transaction types

### Source Name
User-facing broker name: `"Freetrade"`

### UK Tax Year Handling
Our app already supports UK tax years (April 6 - April 5).
Freetrade data will align naturally with our existing tax year logic.

## Related Files in Project

- `src/lib/parsers/schwab.ts` - US broker reference (different date format)
- `src/lib/parsers/trading212.ts` - UK broker, good reference for format
- `src/lib/brokerDetector.ts` - Detection chain priority
- `src/utils/taxYear.ts` - UK tax year calculation (already compatible)
- `test-data/` - Sample CSV storage

## Next Actions

1. **Option A - Request sample Freetrade CSV** from user or Freetrade account holder
2. **Option B - Reverse engineer from `investir` tool**:
   ```bash
   git clone https://github.com/tacgomes/investir
   # Examine: src/ or investir/ directory
   # Look for: freetrade parser, test data, CSV examples
   ```
3. **Analyze actual format** once data obtained
4. **Update this document** with confirmed field structure
5. **Implement parser** following project patterns
6. **Add comprehensive tests** with real data examples

## Comparison: Freetrade vs. E-Trade

| Aspect | Freetrade (UK) | E-Trade (US) |
|--------|----------------|--------------|
| **Jurisdiction** | UK (FCA regulated) | US (SEC/FINRA) |
| **Default Currency** | GBP | USD |
| **Date Format** | Likely DD/MM/YYYY | Likely MM/DD/YYYY |
| **Platform** | Mobile-first | Web + Mobile |
| **Export Method** | In-app (Activity tab) | Web download |
| **Account Types** | GIA, ISA, SIPP | Standard brokerage, IRA |
| **Tax Rules** | HMRC (UK) | IRS (US) |
| **CSV Availability** | Yes (since ~2022) | Yes (established) |
| **Format Documentation** | None public | None public |
| **Open Source Parsers** | investir (Python) | Limited |

## Appendix: Research Search Queries Used

- "Freetrade UK broker CSV export format transaction history"
- "Freetrade app export transactions CSV file structure columns"
- "Freetrade statement download CSV format sample"
- site:github.com Freetrade CSV parser
- "Freetrade" CSV columns headers "Title" "Timestamp"
- github raw tacgomes investir freetrade parser
- "Freetrade" activity feed CSV example format

**Result**: No publicly available documentation with exact CSV format specifications found. Open source tool `investir` provides most promising lead for reverse engineering.

---

## Appendix: Freetrade Community Insights

### User-Reported Issues:
- CSV export feature was highly requested (2018-2021) before implementation
- Some users report difficulty parsing the exported CSV
- Community created third-party tools/templates for processing
- Users have requested filtered exports (currently all-or-nothing)

### Feature Limitations:
- Cannot export corporate actions separately
- No API access for automated data retrieval
- Mobile-only export (no web interface)
- Cannot select specific transaction types to export

This suggests Freetrade's CSV may have usability issues that our parser should handle gracefully.
