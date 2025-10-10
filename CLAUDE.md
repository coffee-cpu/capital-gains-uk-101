# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Capital Gains Tax UK 101** is a privacy-focused, browser-only web application that helps UK taxpayers calculate capital gains tax on share transactions. All data processing happens client-side - no backend, no data uploads.

The app imports CSV files from various brokers, normalizes them to a unified format, enriches transactions with GBP conversions, and applies HMRC matching rules (same-day, 30-day bed-and-breakfast, Section 104 pooling) for CGT calculations.

## Common Commands

### Development
```bash
npm run dev              # Start dev server on http://localhost:3000
npm run build            # TypeScript compile + Vite build
npm run preview          # Preview production build
```

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
CSV Import → Broker Detection → Normalization → FX Enrichment → CGT Engine → Visualization → PDF Export
```

All processing is client-side. The app uses IndexedDB to persist:
- Imported transactions (normalized format)
- Cached FX rates from Bank of England API

### Key Concepts

#### 1. Transaction Schema (`src/types/transaction.ts`)
Two schemas exist:
- **GenericTransaction**: Normalized input format after CSV parsing. Required fields: `id`, `source`, `date`, `type`, `currency`. All transactions are converted to this unified format regardless of broker.
- **EnrichedTransaction**: Extends GenericTransaction with computed fields: `fx_rate`, `price_gbp`, `value_gbp`, `fee_gbp`, `fx_source`, `tax_year`, `gain_group` (HMRC matching rule).

Transaction types: `BUY`, `SELL`, `DIVIDEND`, `FEE`, `INTEREST`, `TRANSFER`, `TAX`

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

#### 3. State Management
- **Runtime state**: Zustand store (`src/stores/transactionStore.ts`) holds currently loaded transactions and selected tax year
- **Persistence**: Dexie database (`src/lib/db.ts`) with two tables:
  - `transactions`: Indexed by id, source, symbol, date, type
  - `fx_rates`: Indexed by [date+currency] composite key

#### 4. Tax Year Calculation (`src/utils/taxYear.ts`)
UK tax years run April 6 to April 5. Format: `2023/24` means 6 April 2023 to 5 April 2024.

#### 5. HMRC CGT Matching Rules (🚧 In Development)
When implemented, the CGT engine will apply rules in this order:
1. **Same-Day Rule**: Match buys/sells on same calendar day
2. **30-Day Rule**: Match repurchases within 30 days after disposal ("bed and breakfast")
3. **Section 104 Pool**: Remaining holdings pooled for average cost basis

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

### Testing Strategy
- **Unit tests**: All parsers, detector logic, utility functions
- **E2E tests**: Full import workflow with real CSV files
- Test files mirror source structure: `src/lib/foo.ts` → `src/lib/__tests__/foo.test.ts`
- E2E tests in separate `e2e/` directory

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

### FX Rate Enrichment (🚧 Planned)
Bank of England API will provide historical GBP rates. Cache in `fx_rates` table with composite key `[date+currency]`.

### HMRC Rule Implementation (🚧 Planned)
Reference official HMRC guidance when implementing:
- CG51560 - Same-day rule
- CG51573 - 30-day "bed and breakfast" rule
- CG51620 - Section 104 pooled holdings

### Current Status
As of the latest commits:
- ✅ Basic CSV import and storage
- ✅ Schwab parser (standard + equity awards)
- ✅ Generic CSV format support
- ✅ Duplicate file detection
- ✅ Transaction list UI
- 🚧 FX rate enrichment (not yet implemented)
- 🚧 CGT matching engine (not yet implemented)
- 🚧 PDF export (not yet implemented)

Refer to README.md for user-facing status and ROADMAP.md for planned features.
