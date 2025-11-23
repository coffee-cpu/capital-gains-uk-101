# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Capital Gains Tax Visualiser** is a privacy-focused, browser-only web application that helps UK taxpayers calculate capital gains tax on share transactions. All data processing happens client-side - no backend, no data uploads.

The app imports CSV files from various brokers, normalizes them to a unified format, enriches transactions with GBP conversions, and applies HMRC matching rules (same-day, 30-day bed-and-breakfast, Section 104 pooling) for CGT calculations.

## Common Commands

### Development
```bash
npm run dev              # Start dev server on http://localhost:3000
npm run build            # TypeScript compile + Vite build
npm run preview          # Preview production build
```

**IMPORTANT - Auto-start Dev Server**: When starting work on this project (especially in a new session), **automatically start the dev server in the background** using the Bash tool with `run_in_background: true`:
```
Bash tool: npm run dev (with run_in_background: true)
```
This allows:
- Real-time verification of changes in the browser
- Immediate detection of compilation errors via Vite HMR
- Running E2E debug tests (`npx playwright test e2e/debug.spec.ts --headed`) without manual setup
- User to verify changes at http://localhost:3000 (or 3001 if 3000 is taken)

The dev server will run in the background and hot-reload on file changes. You can check its output anytime using the BashOutput tool. Only skip auto-starting if the user explicitly says they don't need it running.

### Testing
```bash
npm test                 # Run unit tests (Vitest)
npm run test:watch       # Run tests in watch mode
npm run test:ui          # Open Vitest UI
npm run test:coverage    # Generate coverage report
npm run test:e2e         # Run E2E tests (Playwright)
npm run test:e2e:ui      # Open Playwright UI
npm run test:all         # Run both unit and E2E tests
```

### Single Test Examples
```bash
npx vitest run src/lib/__tests__/brokerDetector.test.ts
npx playwright test e2e/import.spec.ts
```

## Architecture

### Tech Stack
- **React 19** with TypeScript (strict mode enabled)
- **Vite** as build tool
- **TailwindCSS v4** for styling
- **Zustand** for runtime state management
- **Dexie** for IndexedDB persistence (local storage)
- **Zod** for schema validation
- **PapaParse** for CSV parsing
- **Vitest** for unit tests (jsdom environment)
- **Playwright** for E2E tests

### Core Data Flow

```
CSV Import → Broker Detection → Parsing (to GenericTransaction) → Enrichment (3 passes) → CGT Engine → Visualization → PDF Export
```

**Terminology**:
- **Parsing/Normalization**: Converting broker-specific CSV formats to `GenericTransaction` (unified structure, raw data only)
- **Enrichment**: Adding computed fields to create `EnrichedTransaction` (split adjustments → FX conversion → tax year)

All processing is client-side. The app uses IndexedDB to persist:
- Imported transactions (GenericTransaction format with raw data)
- Cached FX rates from Bank of England API

### Key Concepts

#### 1. Transaction Schema & Separation of Concerns (`src/types/transaction.ts`)

**IMPORTANT**: Maintain strict separation between raw data and computed fields.

**GenericTransaction** = Raw parsed data from CSV (NO calculations)
- Represents the original broker statement exactly as imported
- Required fields: `id`, `source`, `date`, `type`, `symbol`, `currency`, `quantity`, `price`, `total`, `fee`
- Transaction types: `BUY`, `SELL`, `DIVIDEND`, `FEE`, `INTEREST`, `TRANSFER`, `TAX`, `STOCK_SPLIT`
- This is what parsers (`src/lib/parsers/`) output after converting broker-specific formats to a unified structure

**EnrichedTransaction** = GenericTransaction + All computed fields
- Extends GenericTransaction with calculations performed during enrichment
- Three enrichment passes (see `src/lib/enrichment.ts`):
  1. **Stock split adjustments**: `split_adjusted_quantity`, `split_adjusted_price`, `split_multiplier`, `applied_splits`
  2. **FX conversion**: `fx_rate`, `price_gbp`, `value_gbp`, `fee_gbp`, `fx_source`
  3. **Tax year & CGT**: `tax_year`, `gain_group`, `match_groups`

**Why This Matters**:
- ✅ **Audit trail**: Original quantities match broker statements exactly
- ✅ **Transparency**: UI shows both original and computed values
- ✅ **Correctness**: CGT calculations use split-adjusted quantities, but users can verify original data
- ❌ **DON'T**: Put computed fields in GenericTransaction
- ❌ **DON'T**: Call split adjustments "normalization" - that term is for converting broker formats to GenericTransaction

**Example Flow**:
```typescript
// Parsing: Schwab CSV → GenericTransaction
{ id: '1', symbol: 'AAPL', date: '2020-06-15', quantity: 25, price: 360.00 }

// Enrichment Pass 1: Stock splits (4:1 split on 2020-08-31)
{ ...above, split_adjusted_quantity: 100, split_adjusted_price: 90.00, split_multiplier: 4.0 }

// Enrichment Pass 2: FX conversion
{ ...above, fx_rate: 1.25, price_gbp: 288.00, value_gbp: 7200.00 }

// Enrichment Pass 3: Tax year & CGT matching
{ ...above, tax_year: '2020/21', gain_group: 'SECTION_104' }
```

#### 2. Broker Detection & Parsing (`src/lib/brokerDetector.ts`, `src/lib/parsers/`)
The `detectBroker()` function inspects CSV headers to identify the source format. Each broker has a parser in `src/lib/parsers/` that converts raw CSV rows to GenericTransaction format.

Detection order (important for overlapping formats):
1. Generic CSV (checks first - most explicit with required headers: `date`, `type`, `symbol`, `currency`)
2. Schwab Equity Awards (before regular Schwab - has unique headers like `FairMarketValuePrice`, `NetSharesDeposited`)
3. Charles Schwab (standard brokerage transactions)
4. Trading 212 (planned)

Each parser must:
- Generate unique IDs (pattern: `${fileId}-${rowIndex}`)
- Convert dates to ISO format (YYYY-MM-DD)
- Parse currency amounts (handle $, commas, etc.)
- Map broker-specific actions to standard TransactionType

#### 3. Enrichment Pipeline (`src/lib/enrichment.ts`)

The `enrichTransactions()` function performs three sequential passes:

```typescript
export async function enrichTransactions(
  transactions: GenericTransaction[]  // Raw CSV data
): Promise<EnrichedTransaction[]> {   // Fully computed
  // Pass 1: Stock split adjustments (sync)
  const normalized = applySplitNormalization(transactions)

  // Pass 2: FX conversion (async - API calls)
  for (const tx of normalized) {
    const fxRate = await getFXRate(tx.date, tx.currency)
    // ... convert to GBP
  }

  // Pass 3: Tax year calculation (sync)
  // ... assign UK tax years
}
```

**Why this order?**
1. Stock splits must be applied first (quantities must be in comparable units)
2. FX conversion happens on normalized quantities
3. Tax year is independent of other fields

#### 4. State Management
- **Runtime state**: Zustand store (`src/stores/transactionStore.ts`) holds currently loaded transactions and selected tax year
- **Persistence**: Dexie database (`src/lib/db.ts`) with two tables:
  - `transactions`: Indexed by id, source, symbol, date, type
  - `fx_rates`: Indexed by [date+currency] composite key

#### 5. Tax Year Calculation (`src/utils/taxYear.ts`)
UK tax years run April 6 to April 5. Format: `2023/24` means 6 April 2023 to 5 April 2024.

#### 6. HMRC CGT Matching Rules (`src/lib/cgt/`)
The CGT engine applies rules in this order:
1. **Same-Day Rule**: Match buys/sells on same calendar day (TCGA92/S105(1))
2. **30-Day Rule**: Match repurchases within 30 days after disposal - "bed and breakfast" (TCGA92/S106A(5))
3. **Section 104 Pool**: Remaining holdings pooled for average cost basis (TCGA92/S104)

**Important**: CGT matching uses `split_adjusted_quantity ?? quantity` from the enrichment pipeline via `getEffectiveQuantity()` helper.

See `docs/SPECIFICATION.md` for complete HMRC rule references.

## Project Structure

```
src/
├── lib/
│   ├── brokerDetector.ts      # CSV format detection logic
│   ├── csvParser.ts            # PapaParse wrapper
│   ├── db.ts                   # Dexie IndexedDB setup
│   └── parsers/                # Broker-specific normalizers
│       ├── schwab.ts           # Charles Schwab standard transactions
│       ├── schwabEquityAwards.ts # Schwab equity award releases
│       └── generic.ts          # Generic CSV (already normalized)
├── types/
│   ├── transaction.ts          # Zod schemas for GenericTransaction & EnrichedTransaction
│   └── broker.ts               # BrokerType enum, detection types
├── stores/
│   └── transactionStore.ts     # Zustand runtime state
├── utils/
│   └── taxYear.ts              # Tax year calculation helpers
├── components/
│   ├── CSVImporter.tsx         # File upload & import workflow
│   ├── TransactionList.tsx     # Display transaction table
│   ├── ClearDataButton.tsx     # IndexedDB reset
│   └── Footer.tsx              # App footer
├── App.tsx                     # Main app component
└── main.tsx                    # React entry point

e2e/                            # Playwright E2E tests
test-data/                      # Sample CSV files for testing
docs/SPECIFICATION.md           # Detailed technical spec
```

## Development Guidelines

### Adding a New Broker Parser

1. Define broker detection in `src/lib/brokerDetector.ts`:
   - Add new `BrokerType` enum value in `src/types/broker.ts`
   - Implement detection function checking for unique headers
   - Add to detection chain in correct priority order

2. Create parser in `src/lib/parsers/{broker}.ts`:
   - Export `normalize{Broker}Transactions(rows, fileId)` function
   - Parse broker-specific date format to ISO YYYY-MM-DD
   - Parse currency values (remove symbols, commas)
   - Map broker actions to TransactionType enum
   - Generate unique IDs: `${fileId}-${rowIndex}`
   - Set source name (user-facing broker name)
   - Return GenericTransaction[]

3. Write tests in `src/lib/parsers/__tests__/{broker}.test.ts`
   - Test date parsing edge cases
   - Test currency parsing (positive/negative, with symbols)
   - Test action mapping to transaction types
   - Use real CSV examples from `test-data/`

4. Update `src/lib/csvParser.ts` to route detected broker to new parser

5. Add sample CSV file to `test-data/` directory

### Transaction ID Generation
IDs must be unique within a session. Pattern: `${fileId}-${rowIndex}` where:
- `fileId`: Unique identifier for the uploaded file (e.g. hash of filename + timestamp)
- `rowIndex`: Sequential number starting from 1

### Date Formats
Always store dates as ISO 8601: `YYYY-MM-DD`. Parsers must convert from broker-specific formats.

### Type Safety
- All transaction types must validate against GenericTransactionSchema (Zod)
- Use strict TypeScript - compiler options enforce `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- Never use `any` - prefer `unknown` and type guards if needed

### Code Quality
- **Always address linter warnings** before committing code
- Remove unused variables, imports, and parameters
- Fix TypeScript errors and warnings (e.g., TS6133 for unused declarations)
- Ensure proper JSX structure (adjacent elements must be wrapped)
- Use the IDE diagnostics to catch issues: check for warnings in modified files

### Committing Changes
- **IMPORTANT**: Always ask the user to validate changes before committing
- Never commit code without explicit user approval
- Show a summary of changes and ask: "Should I commit and push these changes?"
- Only proceed with `git commit` and `git push` after receiving confirmation
- **Run E2E tests before committing**: Always run `npm run test:e2e` to ensure no regressions before committing changes

### Testing Strategy
- **Unit tests**: All parsers, detector logic, utility functions
- **E2E tests**: Full import workflow with real CSV files
- Test files mirror source structure: `src/lib/foo.ts` → `src/lib/__tests__/foo.test.ts`
- E2E tests in separate `e2e/` directory with fixtures in `e2e/fixtures/`

### Debugging Frontend Issues

**IMPORTANT**: When the page fails to load, appears blank, or UI components are broken, **ALWAYS use Playwright E2E tests with console logging as your FIRST debugging step** before attempting code changes.

#### Quick Debug Test
Use the debug E2E test to capture browser console logs and errors:

```bash
npx playwright test e2e/debug.spec.ts --headed
```

This test (`e2e/debug.spec.ts`):
- Captures all browser console messages (log, error, warning, debug)
- Shows page errors with full stack traces
- Reports failed network requests
- Takes screenshots for visual inspection
- Shows exact file locations where errors occur
- Verifies main components render correctly

#### When to Use Playwright Debugging
Use Playwright debugging **immediately** when:
- Page shows a blank white screen
- Components fail to render
- User reports "page won't load"
- Vite compiles successfully but page doesn't work
- React components throw runtime errors
- State management issues are suspected

#### Common React/Zustand Issues
Based on past issues:
- **Infinite render loops**: Often caused by creating new object/array references in Zustand selectors. Use stable constant references:
  ```typescript
  // ❌ BAD - creates new array on every render
  const data = useStore((state) => state.data ?? [])

  // ✅ GOOD - stable reference
  const EMPTY_ARRAY = []
  const data = useStore((state) => state.data ?? EMPTY_ARRAY)
  ```
- **"Maximum update depth exceeded"**: Usually indicates infinite render loop in selector or effect
- **"getSnapshot should be cached"**: Zustand selector is returning different reference on each call

#### Debugging Workflow
1. **First**: Run `npx playwright test e2e/debug.spec.ts --headed` to capture browser console errors
2. **Then**: Analyze the error messages and stack traces in the terminal output
3. **Finally**: Make targeted fixes based on actual errors (not guesses)

Never attempt fixes without seeing the actual browser error first!

#### Example Usage
When debugging, you can also run the test and check the screenshot:
```bash
npx playwright test e2e/debug.spec.ts --headed
# Screenshot will be saved to: playwright-debug-screenshot.png
```

## Important Notes

### Privacy & Security
- Never add telemetry, analytics, or external data transmission
- All processing must remain client-side
- IndexedDB is the only persistence mechanism

### Data Persistence
The Dexie database (`cgt-visualizer`) persists across sessions. Users can clear data via the UI button which calls `db.delete()`.

### CSV Parsing
PapaParse configuration:
- `header: true` - First row becomes keys
- `skipEmptyLines: true` - Ignore blank rows
- Always handle parsing errors gracefully

### FX Rate Enrichment (✅ Completed)
Bank of England API provides historical GBP rates via HMRC's official exchange rate service. Rates are cached in `fx_rates` IndexedDB table with composite key `[date+currency]`.

### Stock Splits (✅ Completed)
Stock splits are handled per HMRC TCGA92/S127 (share reorganisations):
- Split adjustments are the first enrichment pass (`applySplitNormalization`)
- Pre-split quantities normalized to post-split units for CGT matching
- Original quantities preserved for audit trail
- UI displays both original and split-adjusted values with purple badges

### HMRC CGT Rules (✅ Completed)
Reference official HMRC guidance:
- CG51560 - Same-day rule (TCGA92/S105(1)) and 30-day "bed and breakfast" rule (TCGA92/S106A(5))
- CG51620 - Section 104 pooled holdings (TCGA92/S104)
- CG51127 - Share reorganisations and stock splits (TCGA92/S127)

### Current Status
As of the latest commits:
- ✅ Basic CSV import and storage
- ✅ Schwab parser (standard + equity awards)
- ✅ Generic CSV format support
- ✅ Duplicate file detection
- ✅ Transaction list UI with CGT rule badges
- ✅ FX rate enrichment (HMRC official rates)
- ✅ Stock splits (TCGA92/S127) - full implementation with normalization and CGT integration
- ✅ CGT matching engine (all three rules implemented with 131 passing tests)
- 🚧 PDF export (not yet implemented)

Refer to README.md for user-facing status and ROADMAP.md for planned features.
