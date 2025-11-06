# Capital Gains Tax Visualiser - Roadmap

## 🎯 Current Status
- ✅ CSV import (Schwab, Schwab Equity Awards, Trading 212, Generic CSV)
- ✅ Transaction list display with CGT rule badges
- ✅ Support for all transaction types (BUY, SELL, DIVIDEND, INTEREST, TAX, TRANSFER, FEE, STOCK_SPLIT)
- ✅ Stock split handling (TCGA92/S127) with quantity normalization
- ✅ Visual distinction for non-CGT-relevant transactions
- ✅ Duplicate file detection
- ✅ IndexedDB persistence
- ✅ FX rate conversion using HMRC official exchange rates
- ✅ HMRC-compliant CGT calculation engine (same-day, 30-day, Section 104)
- ✅ Tax year summary dashboard with gains/losses
- ✅ PDF export for tax returns
- ✅ Context-sensitive help panel with CGT rule explanations
- ✅ About page with detailed process overview
- ✅ Clear data functionality
- ✅ Footer with disclaimer
- ✅ Rebranded to "Capital Gains Tax Visualiser"

## 📋 Planned Features

### High Priority

- [x] **Generic CSV Input Support** ✅ *Completed 2025-10-09*
  - Standard CSV format with predefined columns matching GenericTransaction schema
  - Simple mode selection (Broker CSV vs Generic CSV)
  - Clear documentation of required/optional fields

- [x] **About Page** ✅ *Completed 2025-10-20*
  - How the calculator works
  - HMRC matching rules explanation
  - Disclaimer and legal info
  - Privacy guarantee details

- [x] **Rebrand to "Capital Gains Tax Visualiser"** ✅ *Completed 2025-10-19*
  - Update all branding
  - Update README
  - Update sidebar with logo and new name

- [x] **Context-Sensitive Help Panel** ✅ *Completed 2025-11-06*
  - Desktop-only overlay panel with detailed CGT rule explanations
  - Context-aware content (same-day, 30-day, Section 104, stock splits, tax year)
  - 3-tab interface: Explanation, Example, References
  - Interactive examples with step-by-step calculations
  - Links to official HMRC docs:
    - [CG51560 - Same-day and 30-day matching rules](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560)
    - [CG51620 - Section 104 pooled holdings](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51620)
    - [CG51700 - Share reorganisations (stock splits)](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51700)
    - [HS284 - Shares and Capital Gains Tax](https://www.gov.uk/government/publications/shares-and-capital-gains-tax-hs284-self-assessment-helpsheet)
  - Click-triggered from CGT badges and help icon
  - Auto-close on click outside or Escape key
  - Markdown-style formatting support

- [ ] **Tax Year Allowances**
  - Display annual CGT allowance (£3,000 for 2024/25)
  - Show used vs remaining allowance
  - Historical allowance amounts
  - Tax year selector

### Core Functionality (per Spec)

- [x] **FX Rate Integration** ✅ *Completed 2025-10-25*
  - Bank of England API integration
  - Historical rate fetching
  - Cache rates in IndexedDB
  - HMRC official monthly exchange rates

- [x] **Transaction Enrichment** ✅ *Completed 2025-10-25*
  - Convert all amounts to GBP
  - Calculate tax year for each transaction
  - Add FX rate metadata
  - Stock split quantity normalization

- [x] **CGT Matching Engine** ✅ *Completed 2025-10-30*
  - Same-day rule implementation (TCGA92/S105(1))
  - 30-day "bed and breakfast" rule (TCGA92/S106A(5))
  - Section 104 pooled holdings (TCGA92/S104)
  - Visual matching indicators with color-coded badges

- [x] **Tax Year Selector** ✅ *Completed 2025-10-31*
  - Switch between available tax years
  - Recalculate gains for selected year
  - Display period dates (6 April - 5 April)

- [ ] **Charts & Visualizations**
  - Gains/losses over time
  - Holdings breakdown
  - Tax liability visualization

- [x] **PDF Export** ✅ *Completed 2025-11-02*
  - Generate tax report
  - Include all calculations
  - Disposal records with rule matching
  - Section 104 pool summary

### Additional Brokers

- [x] **Schwab Equity Awards Support** ✅ *Completed 2025-10-09*
  - Parser for RSU vests with multi-row format
  - Tax withholding calculations
  - Auto-detection alongside regular Schwab
  - Unit tests with sample data

- [x] **Trading 212 Support** ✅ *Completed 2025-10-28*
  - Parser implementation with stock split support
  - Column mapping for all transaction types
  - Test fixtures
  - Auto-detection alongside other brokers

- [ ] **Interactive Brokers**
- [ ] **Vanguard**
- [ ] **Hargreaves Lansdown**

### UX Improvements

- [ ] **Bulk Actions**
  - Select multiple transactions
  - Delete selected
  - Export selected

- [ ] **Search & Filter**
  - Filter by symbol
  - Filter by type
  - Date range filter
  - Search transactions

- [ ] **Transaction Editing**
  - Manual entry
  - Edit imported transactions
  - Add notes

- [ ] **Data Export**
  - Export to CSV
  - Export to JSON
  - Backup all data

### Polish

- [ ] **Dark Mode**
- [ ] **Keyboard Shortcuts**
- [ ] **Loading States**
- [ ] **Error Boundaries**
- [ ] **Offline Mode Indicator**
- [ ] **Progressive Web App (PWA)**

## 🐛 Known Issues

- None currently

## 💡 Ideas for Future

- Multi-currency portfolio support
- Share class tracking (Class A vs C)
- Dividend reinvestment tracking
- Cost basis election (FIFO vs specific ID)
- Integration with broker APIs (if available)

---

## 📝 Note to Developers

**IMPORTANT**: When completing a feature from this roadmap:
1. Mark the item as completed with `[x]` and add completion date
2. Update the "Current Status" section if it's a major feature
3. Commit the ROADMAP.md update along with the feature code
4. This ensures the roadmap stays in sync with actual progress

**Last Updated:** 2025-11-06
