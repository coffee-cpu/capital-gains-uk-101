# CGT Visualizer - Roadmap

## 🎯 Current Status
- ✅ CSV import (Schwab)
- ✅ Transaction list display
- ✅ Duplicate file detection
- ✅ IndexedDB persistence
- ✅ Clear data functionality
- ✅ Footer with disclaimer

## 📋 Planned Features

### High Priority

- [ ] **Generic CSV Input Support**
  - Allow users to manually map CSV columns
  - Preview and column selection UI
  - Save mapping templates for reuse

- [ ] **About Page**
  - How the calculator works
  - HMRC matching rules explanation
  - Disclaimer and legal info
  - Privacy guarantee details

- [ ] **Rebrand to "Capital Gains Tax UK 101"**
  - Update all branding
  - Update README
  - Update repository name/description

- [ ] **Explanation Panel**
  - Right sidebar with matching rules
  - Color-coded examples
  - Links to official HMRC docs:
    - [CG51500P](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51500p)
    - [CG51560](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560)
    - [CG51573](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51573)
    - [CG51620](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51620)
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

**Last Updated:** 2025-10-08
