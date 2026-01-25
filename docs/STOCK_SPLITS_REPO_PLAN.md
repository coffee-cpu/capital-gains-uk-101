# Stock Splits Data Repository Plan

## Overview

A community-maintained, open-source catalog of stock split data, designed for:
- Client-side fetching via CDN (jsDelivr)
- Automated weekly updates via GitHub Actions
- Easy contribution via PRs

**Target users**: Financial apps, CGT calculators, portfolio trackers

---

## Repository Structure

```
stock-splits-data/
├── README.md                    # Usage docs, badges, examples
├── CONTRIBUTING.md              # How to add/update splits
├── LICENSE                      # MIT
├── .github/
│   └── workflows/
│       ├── check-new-splits.yml # Weekly: fetch new splits from APIs
│       ├── validate-data.yml    # On PR: validate JSON schema
│       └── build-index.yml      # On merge: rebuild combined index
├── schema/
│   ├── split-entry.schema.json  # Schema for individual entries
│   └── year-file.schema.json    # Schema for yearly files
├── data/
│   ├── index.json               # Combined lookup (auto-generated)
│   ├── metadata.json            # Last updated, version, stats
│   ├── 2020.json                # Splits effective in 2020
│   ├── 2021.json
│   ├── 2022.json
│   ├── 2023.json
│   ├── 2024.json
│   └── 2025.json
├── symbols/                     # Optional: per-symbol files for large datasets
│   ├── AAPL.json
│   ├── TSLA.json
│   └── ...
└── scripts/
    ├── fetch-finnhub.ts         # Fetch from Finnhub API
    ├── fetch-polygon.ts         # Fetch from Polygon API
    ├── build-index.ts           # Generate index.json from yearly files
    ├── validate.ts              # Validate all data against schema
    └── dedupe.ts                # Find and remove duplicates
```

---

## Data Format

### Yearly File (`data/2024.json`)

```json
{
  "$schema": "../schema/year-file.schema.json",
  "year": 2024,
  "updated": "2025-01-25T12:00:00Z",
  "count": 42,
  "splits": [
    {
      "symbol": "NVDA",
      "name": "NVIDIA Corporation",
      "isin": "US67066G1040",
      "exchange": "NASDAQ",
      "date": "2024-06-10",
      "ratio": "10:1",
      "source": "finnhub",
      "verified": true
    },
    {
      "symbol": "AVGO",
      "name": "Broadcom Inc.",
      "isin": "US11135F1012",
      "exchange": "NASDAQ",
      "date": "2024-07-15",
      "ratio": "10:1",
      "source": "polygon",
      "verified": true
    }
  ]
}
```

### Combined Index (`data/index.json`)

Auto-generated, optimized for client-side lookup:

```json
{
  "version": "1.0.0",
  "updated": "2025-01-25T12:00:00Z",
  "totalSplits": 250,
  "years": [2020, 2021, 2022, 2023, 2024, 2025],
  "bySymbol": {
    "NVDA": {
      "name": "NVIDIA Corporation",
      "isin": "US67066G1040",
      "splits": [
        { "date": "2024-06-10", "ratio": "10:1" },
        { "date": "2021-07-20", "ratio": "4:1" }
      ]
    },
    "TSLA": {
      "name": "Tesla, Inc.",
      "isin": "US88160R1014",
      "splits": [
        { "date": "2022-08-25", "ratio": "3:1" },
        { "date": "2020-08-31", "ratio": "5:1" }
      ]
    }
  },
  "byIsin": {
    "US67066G1040": "NVDA",
    "US88160R1014": "TSLA"
  }
}
```

### Metadata (`data/metadata.json`)

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-01-25T12:00:00Z",
  "lastCheck": "2025-01-25T12:00:00Z",
  "stats": {
    "totalSymbols": 150,
    "totalSplits": 250,
    "byYear": {
      "2024": 42,
      "2023": 38,
      "2022": 35
    }
  },
  "sources": {
    "finnhub": { "enabled": true, "lastFetch": "2025-01-25" },
    "polygon": { "enabled": true, "lastFetch": "2025-01-25" }
  }
}
```

---

## GitHub Actions Workflows

### 1. Weekly Split Check (`check-new-splits.yml`)

```yaml
name: Check for New Splits

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM UTC
  workflow_dispatch:      # Manual trigger

jobs:
  check-splits:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Fetch from Finnhub
        env:
          FINNHUB_API_KEY: ${{ secrets.FINNHUB_API_KEY }}
        run: npm run fetch:finnhub

      - name: Fetch from Polygon
        env:
          POLYGON_API_KEY: ${{ secrets.POLYGON_API_KEY }}
        run: npm run fetch:polygon

      - name: Deduplicate and validate
        run: |
          npm run dedupe
          npm run validate

      - name: Check for changes
        id: changes
        run: |
          if git diff --quiet data/; then
            echo "has_changes=false" >> $GITHUB_OUTPUT
          else
            echo "has_changes=true" >> $GITHUB_OUTPUT
          fi

      - name: Create PR if changes found
        if: steps.changes.outputs.has_changes == 'true'
        uses: peter-evans/create-pull-request@v5
        with:
          title: "feat: add new stock splits (automated)"
          body: |
            Automated weekly check found new stock splits.

            ## Sources checked
            - Finnhub API
            - Polygon API

            ## Changes
            $(git diff --stat data/)

            Please review and merge if accurate.
          branch: auto/weekly-splits-update
          commit-message: "feat: add new stock splits from weekly check"
          labels: automated, splits-update
```

### 2. Validate on PR (`validate-data.yml`)

```yaml
name: Validate Data

on:
  pull_request:
    paths:
      - 'data/**'
      - 'schema/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Validate JSON schema
        run: npm run validate

      - name: Check for duplicates
        run: npm run check:duplicates

      - name: Verify ISIN format
        run: npm run check:isin

      - name: Check date consistency
        run: npm run check:dates
```

### 3. Build Index on Merge (`build-index.yml`)

```yaml
name: Build Index

on:
  push:
    branches: [main]
    paths:
      - 'data/*.json'
      - '!data/index.json'
      - '!data/metadata.json'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Build combined index
        run: npm run build:index

      - name: Update metadata
        run: npm run build:metadata

      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/index.json data/metadata.json
          git commit -m "chore: rebuild index and metadata" || exit 0
          git push
```

---

## API Integration Strategy

### Primary: Finnhub (Free tier: 60 calls/min)

```typescript
// scripts/fetch-finnhub.ts
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

async function fetchSplits(symbol: string, from: string, to: string) {
  const url = `${FINNHUB_BASE}/stock/split?symbol=${symbol}&from=${from}&to=${to}&token=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

// Response format:
// [{ "date": "2024-06-10", "fromFactor": 1, "toFactor": 10, "symbol": "NVDA" }]
```

### Secondary: Polygon (Free tier: unlimited, delayed)

```typescript
// scripts/fetch-polygon.ts
const POLYGON_BASE = 'https://api.polygon.io/v3';

async function fetchSplits(from: string, to: string) {
  const url = `${POLYGON_BASE}/reference/splits?execution_date.gte=${from}&execution_date.lte=${to}&apiKey=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

// Response format:
// { "results": [{ "ticker": "NVDA", "execution_date": "2024-06-10", "split_from": 1, "split_to": 10 }] }
```

### Fetch Strategy

1. **Weekly job** checks last 14 days (overlap for safety)
2. **Polygon first** (unlimited calls) to get all recent splits
3. **Finnhub second** to fill gaps and verify
4. **Deduplicate** by symbol + date
5. **Create PR** for human review before merge

---

## Client Usage

### Via jsDelivr CDN

```javascript
// Fetch combined index (recommended)
const INDEX_URL = 'https://cdn.jsdelivr.net/gh/YOUR_ORG/stock-splits-data@main/data/index.json';

async function getSplits(symbol) {
  const res = await fetch(INDEX_URL);
  const data = await res.json();
  return data.bySymbol[symbol]?.splits || [];
}

// Or fetch specific year
const YEAR_URL = 'https://cdn.jsdelivr.net/gh/YOUR_ORG/stock-splits-data@main/data/2024.json';
```

### With caching

```javascript
const CACHE_KEY = 'stock-splits-index';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getSplitsWithCache(symbol) {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL) {
      return data.bySymbol[symbol]?.splits || [];
    }
  }

  const res = await fetch(INDEX_URL);
  const data = await res.json();
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  return data.bySymbol[symbol]?.splits || [];
}
```

---

## Contribution Guidelines

### Adding a Split Manually

1. Fork the repository
2. Edit the appropriate year file (e.g., `data/2025.json`)
3. Add the split entry with all required fields
4. Run `npm run validate` locally
5. Submit PR with source link (e.g., company announcement)

### Required Fields

| Field | Required | Description |
|-------|----------|-------------|
| `symbol` | Yes | Ticker symbol (uppercase) |
| `name` | Yes | Full company name |
| `date` | Yes | Effective date (YYYY-MM-DD) |
| `ratio` | Yes | Split ratio (e.g., "10:1") |
| `isin` | Recommended | For cross-broker matching |
| `exchange` | Recommended | Primary exchange |
| `source` | Recommended | Where data came from |
| `verified` | Optional | Human-verified (default: false) |

### Verification Sources

- Company investor relations announcements
- SEC filings (Form 8-K)
- Exchange announcements (NYSE, NASDAQ)

---

## Initial Data Migration

1. Copy splits from `capital-gains-uk-101/data/stock-splits.json`
2. Split into yearly files by effective date
3. Add `source: "manual"` and `verified: true` for researched entries
4. Run validation
5. Build initial index

---

## Roadmap

### Phase 1: Foundation
- [ ] Create repository with structure above
- [ ] Migrate existing data from capital-gains-uk-101
- [ ] Set up JSON schema validation
- [ ] Add basic README and contribution docs

### Phase 2: Automation
- [ ] Implement Finnhub fetch script
- [ ] Implement Polygon fetch script
- [ ] Set up weekly GitHub Action
- [ ] Add PR auto-creation for new splits

### Phase 3: Enhancement
- [ ] Add more data sources (FMP, Alpha Vantage)
- [ ] Add reverse split detection and flagging
- [ ] Add symbol aliases for ADRs
- [ ] Add ISIN lookup/validation

### Phase 4: Community
- [ ] Add GitHub Discussions for split requests
- [ ] Create issue templates for missing splits
- [ ] Add contributor recognition
- [ ] Consider npm package for easier integration

---

## Secrets Required

For GitHub Actions to work, add these repository secrets:

| Secret | Source | Free Tier |
|--------|--------|-----------|
| `FINNHUB_API_KEY` | https://finnhub.io/register | 60 calls/min |
| `POLYGON_API_KEY` | https://polygon.io/dashboard/signup | Unlimited (delayed) |

---

## License

MIT - free to use in any project, commercial or open source.
