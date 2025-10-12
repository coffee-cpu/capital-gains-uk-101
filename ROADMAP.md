# Capital Gains Tax UK 101 - Roadmap

## 🎯 Current Status
- ✅ CSV import (Schwab, Schwab Equity Awards, Generic CSV)
- ✅ Transaction list display
- ✅ Support for all transaction types (BUY, SELL, DIVIDEND, INTEREST, TAX, TRANSFER, FEE)
- ✅ Visual distinction for non-CGT-relevant transactions
- ✅ Duplicate file detection
- ✅ IndexedDB persistence
- ✅ Clear data functionality
- ✅ Footer with disclaimer
- ✅ Rebranded to "Capital Gains Tax UK 101"
- ✅ Generic CSV import (auto-detected)

## 📋 Planned Features

### High Priority

- [x] **Generic CSV Input Support** ✅ *Completed 2025-10-09*
  - Standard CSV format with predefined columns matching GenericTransaction schema
  - Simple mode selection (Broker CSV vs Generic CSV)
  - Clear documentation of required/optional fields

- [ ] **About Page**
  - How the calculator works
  - HMRC matching rules explanation
  - Disclaimer and legal info
  - Privacy guarantee details

- [x] **Rebrand to "Capital Gains Tax UK 101"** ✅ *Completed 2025-10-09*
  - Update all branding
  - Update README
  - Update repository name/description

- [ ] **Explanation Panel**
  - Right sidebar with matching rules
  - Color-coded examples
  - Links to official HMRC docs:
    - [CG51500P - Share identification rules overview](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51500p)
    - [CG51560 - Same-day and 30-day matching rules](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560)
    - [CG51620 - Section 104 pooled holdings](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51620)
  - Interactive tooltips

- [ ] **Tax Year Allowances**
  - Display annual CGT allowance (£3,000 for 2024/25)
  - Show used vs remaining allowance
  - Historical allowance amounts
  - Tax year selector

### Core Functionality (per Spec)

- [ ] **FX Rate Integration**
  - Bank of England API integration
  - Historical rate fetching
  - Cache rates in IndexedDB
  - Fallback to manual entry

- [ ] **Transaction Enrichment**
  - Convert all amounts to GBP
  - Calculate tax year for each transaction
  - Add FX rate metadata

- [ ] **CGT Matching Engine**
  - Same-day rule implementation
  - 30-day "bed and breakfast" rule
  - Section 104 pooled holdings
  - Visual matching indicators

- [ ] **Tax Year Selector**
  - Switch between tax years (2022/23, 2023/24, 2024/25)
  - Recalculate gains for selected year
  - Filter transactions by year

- [ ] **Charts & Visualizations**
  - Gains/losses over time
  - Holdings breakdown
  - Tax liability visualization

- [ ] **PDF Export**
  - Generate tax report
  - Include all calculations
  - HMRC-ready format
  - Color-coded matching

### Additional Brokers

- [x] **Schwab Equity Awards Support** ✅ *Completed 2025-10-09*
  - Parser for RSU vests with multi-row format
  - Tax withholding calculations
  - Auto-detection alongside regular Schwab
  - Unit tests with sample data

- [ ] **Trading 212 Support**
  - Parser implementation
  - Column mapping
  - Test fixtures

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

**Last Updated:** 2025-10-09
