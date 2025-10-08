# Capital Gains Tax UK 101

**UK Capital Gains Tax made easy**

A free, privacy-focused web application that helps UK taxpayers understand and calculate capital gains tax on share transactions. All calculations happen in your browser - your data never leaves your device.

## Features

- ✅ CSV import from popular brokers (Charles Schwab, more coming soon)
- ✅ Transaction management with persistent storage
- ✅ Support for all transaction types (buys, sells, dividends, transfers, etc.)
- ✅ Duplicate file detection
- ✅ Privacy-first: all data stored locally in your browser
- 🚧 HMRC-compliant matching rules (same-day, 30-day, Section 104)
- 🚧 Automatic FX rate conversion (Bank of England)
- 🚧 Tax year calculations and allowances
- 🚧 Visual explanations of CGT rules
- 🚧 PDF export for tax returns

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

Capital Gains Tax UK 101 helps you understand and calculate your capital gains tax obligations by:

1. **Importing your transaction history** from broker CSV exports
2. **Converting to GBP** using Bank of England historical rates
3. **Applying HMRC matching rules** to calculate gains/losses
4. **Visualizing the results** with clear explanations

All processing happens in your browser using IndexedDB for storage. No data is sent to any server.

## Supported Brokers

- ✅ Charles Schwab
- 🚧 Trading 212 (coming soon)
- 🚧 Interactive Brokers (planned)
- 🚧 Vanguard (planned)
- 🚧 Hargreaves Lansdown (planned)

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS v4** - Styling
- **Zustand** - State management
- **Dexie** - IndexedDB wrapper
- **Zod** - Schema validation
- **Vitest** - Unit testing
- **Playwright** - E2E testing

## Contributing

Contributions are welcome! Please see [SPECIFICATION.md](./docs/SPECIFICATION.md) for technical details and [ROADMAP.md](./ROADMAP.md) for planned features.

## Disclaimer

This tool is for informational purposes only. It is not financial or tax advice. Always consult with a qualified tax professional for your specific situation. The developers are not responsible for any errors in calculations or tax reporting.

## License

MIT
