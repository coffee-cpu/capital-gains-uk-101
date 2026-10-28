# Capital Gains Tax Visualiser

**UK Capital Gains Tax made easy**

**Try it now at [cgtvisualiser.co.uk](https://cgtvisualiser.co.uk)**

A free, privacy-focused web application that helps UK taxpayers understand and calculate capital gains tax on share transactions. All calculations happen in your browser - your data never leaves your device.

## Features

- ✅ CSV import from popular brokers (Charles Schwab, Trading 212, Interactive Brokers, Freetrade, EquatePlus, Revolut, Coinbase, Generic CSV format)
- ✅ Transaction management with persistent storage
- ✅ Support for all transaction types (buys, sells, dividends, transfers, stock splits, etc.)
- ✅ Stock split handling (TCGA92/S127) with split-adjusted quantities
- ✅ Duplicate file detection
- ✅ Privacy-first: all data stored locally in your browser
- ✅ Automatic FX rate conversion using HMRC official exchange rates
- ✅ Tax year calculations (UK tax years: 6 April to 5 April)
- ✅ HMRC-compliant CGT calculation engine:
  - ✅ Same-day matching rule (TCGA92/S105(1))
  - ✅ 30-day "bed and breakfast" rule (TCGA92/S106A(5))
  - ✅ Section 104 pooled holdings (TCGA92/S104)
- ✅ Capital gains/loss calculations with full disposal records
- ✅ Tax year summary dashboard with key metrics and CGT calculations
- ✅ PDF export for tax returns with detailed disposal records
- ✅ Context-sensitive help panel with interactive CGT rule explanations, examples, and HMRC references

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Testing

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e
```

### Build

```bash
npm run build
```

## How It Works

Capital Gains Tax Visualiser helps you understand and calculate your capital gains tax obligations by:

1. **Importing your transaction history** from broker CSV exports
2. **Converting to GBP** using HMRC official monthly exchange rates
3. **Applying HMRC matching rules** in the correct order:
   - Same-day rule: Matches buys and sells on the same day
   - 30-day rule: Matches disposals with repurchases within 30 days
   - Section 104 pool: Remaining shares pooled for average cost basis
4. **Calculating gains and losses** for each disposal with full audit trail
5. **Generating tax year summaries** with total gains, losses, and taxable amounts

All processing happens in your browser using IndexedDB for storage. No data is sent to any server.

### CGT Calculation Engine

The app implements the complete HMRC share matching rules as specified in the Capital Gains Manual:

- **Same-Day Rule** (TCGA92/S105(1) - CG51560): Shares bought and sold on the same day are matched first
- **30-Day Rule** (TCGA92/S106A(5) and (5A) - CG51560): Shares repurchased within 30 days after a sale are matched next ("bed and breakfast" anti-avoidance)
- **Section 104 Pool** (TCGA92/S104 - CG51620): All remaining shares are pooled with average cost basis

Each disposal generates a detailed record showing:
- Proceeds from sale (including fees)
- Cost basis from matched acquisitions
- Gain or loss calculation
- Tax year allocation
- Which HMRC rule was applied

## Supported Brokers

- ✅ Charles Schwab (standard transactions + equity awards)
- ✅ EquatePlus (employee stock plans: RSUs, RSPs, ESPP)
- ✅ Trading 212 (with stock split support)
- ✅ Interactive Brokers
- ✅ Freetrade
- ✅ Revolut
- ✅ Coinbase
- ✅ Coinbase Pro
- ✅ Generic CSV format (universal import)

## Command-Line Tool and AI Agents

The calculation engine is also published as a command-line tool, [`cgt-visualiser`](packages/cli/README.md). It runs locally and outputs text, CSV or versioned JSON, which makes it suitable for scripts and AI agents:

```bash
npx cgt-visualiser calculate my-broker-export.csv --tax-year 2025/26
```

- [CLI README](packages/cli/README.md): commands, options and the JSON schema
- [Agent guide](public/agents.md), served at https://cgtvisualiser.co.uk/agents.md: step-by-step instructions for AI agents
- [`llms.txt`](public/llms.txt), served at https://cgtvisualiser.co.uk/llms.txt

The CLI lives in the `packages/cli` npm workspace. Build it with `npm run build:cli`. To release it, set the version in `packages/cli/package.json` and push a matching `cli-v<version>` tag (e.g. `cli-v0.1.0`); the `Publish CLI to npm` workflow tests, builds and publishes it. See [docs/RELEASING_CLI.md](docs/RELEASING_CLI.md), including the one-time npm setup.

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS v4** - Styling
- **Zustand** - State management
- **Dexie** - IndexedDB wrapper
- **Zod** - Schema validation
- **@react-pdf/renderer** - PDF export
- **Vitest** - Unit testing
- **Playwright** - E2E testing

## Contributing

Contributions are welcome! Please open an issue or pull request on GitHub.

## Disclaimer

This tool is for informational purposes only. It is not financial or tax advice. Always consult with a qualified tax professional for your specific situation. The developers are not responsible for any errors in calculations or tax reporting.

## License

MIT
