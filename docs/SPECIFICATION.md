# Capital Gains Tax Visualiser – Specification

## Overview

**Capital Gains Tax Visualiser** imports transaction exports from brokers (Charles Schwab, Interactive Brokers, Trading 212 and others), converts them to one transaction format, and calculates UK capital gains tax with HMRC's share matching rules. It runs in the browser, or in a terminal as the `cgt-visualiser` CLI (`packages/cli`), with the same engine. There is no backend and transactions are never uploaded.

## Goals

- All processing on the user's device; the only network requests are for public reference data (exchange rates and stock split data)
- Accept broker CSV exports as they are
- Convert them into one transaction format (`GenericTransaction`)
- Convert foreign-currency amounts to GBP with a user-selected rate source
- Adjust for stock splits (TCGA92/S127)
- Apply HMRC's matching rules: same-day, 30-day ("bed and breakfast") and Section 104 pooling
- Show which rule matched each transaction
- Produce a PDF report with the SA108 figures for Self Assessment

## Architecture

Single-page application: React + TypeScript + Vite.

| Purpose | Library |
|---|---|
| CSV parsing | [PapaParse](https://www.papaparse.com/) |
| Persistence | IndexedDB via [Dexie](https://dexie.org/) |
| Runtime state | [Zustand](https://zustand-demo.pmnd.rs/) |
| Schema validation | [Zod](https://zod.dev/) |
| FX rates | HMRC monthly and yearly rates (bundled, newer months from gov.uk and trade-tariff.service.gov.uk) and ECB daily rates via [Frankfurter](https://frankfurter.dev/) |
| Charts | [Recharts](https://recharts.org/) |
| PDF export | [@react-pdf/renderer](https://react-pdf.org/) |
| Styling | Tailwind CSS v4 |
| Tests | [Vitest](https://vitest.dev/) (unit), [Playwright](https://playwright.dev/) (E2E) |

## Data flow

```
CSV import → broker detection → parsing (GenericTransaction) → deduplication → auto-fetched stock splits
→ ISIN symbol matching → enrichment (splits → FX → tax year) → CGT matching → UI / PDF / CLI output
```

- **Broker detection** (`src/lib/brokerDetector.ts`) checks the headers against the broker definitions in `src/config/brokers/`, in priority order.
- **Parsing** (`src/lib/parsers/`) converts each broker's rows to `GenericTransaction`. Every parsed row is validated against the schema below; rows that fail are reported as skipped.
- **Deduplication** (`src/utils/deduplication.ts`) drops rows repeated across overlapping exports from the same broker, and Schwab Stock Plan Activity rows superseded by an Equity Awards file.
- **Auto-fetched splits** (`src/lib/splits/`): stock split rows from community data, added for shares the user holds when the setting is on. They are not stored.
- **ISIN symbol matching** (`src/lib/symbolMatching.ts`) gives one symbol to a security that brokers list under different tickers.
- **Enrichment** (`src/lib/enrichment/`) adds computed fields without changing the parsed ones.
- **CGT matching** (`src/lib/cgt/`) applies the matching rules and builds disposal records and tax year summaries.

`runPipeline` in `src/lib/pipeline.ts` runs every step after parsing. The web app and the CLI both call it.

## Data model

### GenericTransaction (parsed data)

The raw data from a broker file, before anything is calculated. Generated from `GenericTransactionSchema` in `src/types/transaction.ts` (a test fails if this copy is out of date):

<!-- generic-transaction-schema:start -->
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Locally generated unique identifier"
    },
    "source": {
      "type": "string",
      "description": "Broker or source file name"
    },
    "symbol": {
      "type": "string",
      "description": "Stock ticker or ISIN code"
    },
    "name": {
      "description": "Full name of the asset",
      "type": [
        "string",
        "null"
      ]
    },
    "date": {
      "type": "string",
      "format": "date",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$",
      "description": "Transaction date in YYYY-MM-DD format"
    },
    "type": {
      "type": "string",
      "enum": [
        "BUY",
        "SELL",
        "DIVIDEND",
        "FEE",
        "INTEREST",
        "TRANSFER",
        "TAX",
        "TAX_ON_DIVIDEND",
        "TAX_ON_INTEREST",
        "STOCK_SPLIT",
        "UNKNOWN",
        "OPTIONS_BUY_TO_OPEN",
        "OPTIONS_SELL_TO_OPEN",
        "OPTIONS_BUY_TO_CLOSE",
        "OPTIONS_SELL_TO_CLOSE",
        "OPTIONS_ASSIGNED",
        "OPTIONS_EXPIRED",
        "OPTIONS_STOCK_SPLIT"
      ],
      "description": "Transaction type"
    },
    "quantity": {
      "description": "Quantity bought or sold",
      "type": [
        "number",
        "null"
      ]
    },
    "price": {
      "description": "Price per unit in transaction currency",
      "type": [
        "number",
        "null"
      ]
    },
    "currency": {
      "type": "string",
      "description": "Original transaction currency (e.g. USD, EUR, GBP)"
    },
    "total": {
      "description": "Total value in original currency",
      "type": [
        "number",
        "null"
      ]
    },
    "fee": {
      "description": "Fee or commission amount",
      "type": [
        "number",
        "null"
      ]
    },
    "fee_currency": {
      "description": "Currency of fee when it differs from currency (e.g. Trading 212 charges fees in the account currency on a USD trade). Absent means the fee is in currency.",
      "type": [
        "string",
        "null"
      ]
    },
    "notes": {
      "description": "Optional broker notes",
      "type": [
        "string",
        "null"
      ]
    },
    "ratio": {
      "description": "Stock split ratio (e.g., \"10:1\", \"2:1\", \"1:10\"). Only used for STOCK_SPLIT transactions.",
      "type": [
        "string",
        "null"
      ]
    },
    "isin": {
      "description": "ISIN security identifier when the source gives one (e.g. Freetrade, Trading 212). Used to match the same security across brokers that use different tickers.",
      "type": [
        "string",
        "null"
      ]
    },
    "asset_class": {
      "description": "Asset class when the source states it (Generic CSV asset_class column). Decides the SA108 section.",
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "share",
            "crypto"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "incomplete": {
      "description": "True if transaction is missing required data (e.g., Stock Plan Activity without price)",
      "type": "boolean"
    },
    "ignored": {
      "description": "True if transaction should be excluded from calculations (e.g., Stock Plan Activity which is always incomplete)",
      "type": "boolean"
    },
    "is_short_sell": {
      "description": "True if this is an explicit short sell as reported by the broker (e.g., Schwab \"Sell Short\" action)",
      "type": "boolean"
    },
    "imported_at": {
      "description": "ISO timestamp when transaction was imported (e.g., 2024-01-15T10:30:00.000Z)",
      "type": "string"
    },
    "underlying_symbol": {
      "description": "For options: the underlying stock symbol (e.g., GOOGL)",
      "type": [
        "string",
        "null"
      ]
    },
    "option_type": {
      "description": "For options: CALL or PUT",
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "CALL",
            "PUT"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "strike_price": {
      "description": "For options: strike price",
      "type": [
        "number",
        "null"
      ]
    },
    "expiration_date": {
      "description": "For options: expiration date in YYYY-MM-DD format",
      "type": [
        "string",
        "null"
      ]
    },
    "contract_size": {
      "description": "For options: shares per contract (typically 100)",
      "type": [
        "number",
        "null"
      ]
    },
    "grossDividend": {
      "description": "Gross dividend amount before withholding tax (in original currency)",
      "type": [
        "number",
        "null"
      ]
    },
    "withholdingTax": {
      "description": "Tax withheld at source on dividends (in original currency)",
      "type": [
        "number",
        "null"
      ]
    }
  },
  "required": [
    "id",
    "source",
    "symbol",
    "name",
    "date",
    "type",
    "quantity",
    "price",
    "currency",
    "total",
    "fee",
    "notes"
  ],
  "additionalProperties": false
}
```
<!-- generic-transaction-schema:end -->

IDs follow `${fileId}-${rowIndex}`; see CLAUDE.md for the exceptions.

### EnrichedTransaction (computed fields)

`EnrichedTransactionSchema` in the same file extends `GenericTransaction` with fields that are computed on every run and never stored:

| Pass | Fields |
|---|---|
| 1. Stock splits | `split_adjusted_quantity`, `split_adjusted_price`, `split_multiplier`, `applied_splits` |
| 2. FX conversion | `fx_rate` (units of currency per £1), `price_gbp`, `split_adjusted_price_gbp`, `value_gbp`, `fee_gbp`, `fx_source`, `fx_error`, `grossDividend_gbp`, `withholdingTax_gbp` |
| 3. Tax year | `tax_year` |
| CGT matching | `match_groups` (the disposals a transaction is matched with) |

Example (invented figures):

```json
{
  "split_adjusted_quantity": 20,
  "split_multiplier": 2,
  "fx_rate": 1.25,
  "price_gbp": 80,
  "value_gbp": 1600,
  "fee_gbp": 4,
  "fx_source": "HMRC Monthly Exchange Rates",
  "tax_year": "2024/25",
  "match_groups": ["schwab_csv-1200-7"]
}
```

## HMRC matching rules

Applied in this order (`src/lib/cgt/engine.ts`):

0. **Short sells**: a sale the broker marks as a short sell (`is_short_sell`) is matched with the later purchases that cover it.
1. **Same-day rule** (TCGA92/S105(1)): purchases and sales of the same shares on one day. All of a day's purchases (and all of its sales) count as one transaction, so a partial match uses the day's average cost.
2. **30-day rule** (TCGA92/S106A(5) and (5A)): purchases in the 30 days after a sale, earliest first. It doesn't apply to purchases made while non-resident; the engine assumes the user was UK resident throughout.
3. **Section 104 pool** (TCGA92/S104): everything else, at the pool's average cost.

Shares sold beyond what these rules match are flagged as an incomplete disposal (usually missing history); the unmatched part adds no gain or loss. HS284 matches them with later purchases, earliest first; the engine does that only for sales the broker marks as short sells. Open finding from the November 2026 audit, not yet decided.

Quantities are split-adjusted before matching. Proceeds are gross, and selling fees are an allowable cost, as SA108 asks. Same-day sales of one share count as one disposal in the tax year totals.

References: [CG51560](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560) (same-day and 30-day rules), [CG51575](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51575) (Section 104 holdings), [CG51700](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51700) (share reorganisations, incl. stock splits), [CG78310](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg78310) (exchange rates).

## Exchange rates

The user picks one source (`src/lib/fx/providers/`): HMRC monthly rates (default), HMRC yearly averages, or ECB daily rates. HMRC doesn't prescribe a source but expects a reasonable one used consistently (CG78310). Fetched rates are cached in IndexedDB.

## Tax years

UK tax years run from 6 April to 5 April and are labelled `2024/25`. The user picks the year shown; the calculation always covers every year, because earlier transactions set the Section 104 pool cost used later.

## Rule colours

| Rule | Colour |
|---|---|
| Same-day | `#4A90E2` (blue) |
| 30-day | `#F5A623` (orange) |
| Section 104 | `#7ED321` (green) |
| Short sell | `#EC4899` (pink) |

## PDF report

One tax year per report (`src/lib/pdf/`), shared by the web app's Export PDF button and the CLI's `--format pdf`:

1. Tax year summary: disposals, proceeds, allowable costs, gains, losses, annual exempt amount and taxable gain
2. SA108 figures, by section
3. Dividend and interest income
4. Disposal details: each disposal's matched acquisitions and rule, with the Section 104 pool
5. Optional appendix: transaction history
6. Disclaimer: the report is an estimate, not tax advice

## Local storage

IndexedDB database `cgt-visualizer` (`src/lib/db.ts`):

- `transactions`: parsed `GenericTransaction` rows
- `fx_rates`: cached exchange rates
- `imported_files`: imported file metadata, for duplicate detection
- `settings`: FX source, auto-splits setting, PDF transaction history option
- `split_data_cache`: fetched stock split data

## License

MIT. Data sources: HMRC exchange rates, ECB reference rates (via Frankfurter), community stock split data, and the user's own broker exports.
