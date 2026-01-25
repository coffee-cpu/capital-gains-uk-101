# Stock Splits Data Sources Research

## Summary

This document researches open sources for stock split data and evaluates the Freetrade parser's split support capability. This addresses [Issue #37](https://github.com/coffee-cpu/capital-gains-uk-101/issues/37).

---

## Freetrade Parser Split Support

### Current Implementation Status: ✅ Supported (Code Exists)

The Freetrade parser (`src/lib/parsers/freetrade.ts:49-51, 252-288`) includes code to handle `STOCK_SPLIT` transactions:

```typescript
if (type === 'STOCK_SPLIT') {
  return parseStockSplitTransaction(row, fileId, rowIndex, date, title, ticker, isin)
}
```

The parser looks for these Freetrade-specific columns:
- `Stock Split Rate of Share Outturn From` - original shares
- `Stock Split Rate of Share Outturn To` - resulting shares

The ratio is constructed as `toShares:fromShares` (e.g., `10:1` for a 10-for-1 split).

### Issue: Freetrade Doesn't Export Split Data ❌

According to [Issue #37](https://github.com/coffee-cpu/capital-gains-uk-101/issues/37), **Freetrade does not include stock split information in their CSV exports**. While the parser code exists, there's no actual data to parse from Freetrade files.

### Workaround

Users can manually add splits using the Generic CSV format. The app provides an example at `public/examples/stock-splits-example.csv`:

```csv
date,type,symbol,split_ratio
2024-06-10,STOCK_SPLIT,NVDA,10:1
2022-08-25,STOCK_SPLIT,TSLA,3:1
```

---

## Open Source Stock Split Data APIs

### 1. Finnhub ⭐ Recommended for Free Tier

**Free Tier:** 60 API calls/minute

**Endpoint:**
```
GET https://finnhub.io/api/v1/stock/split?symbol=AAPL&from=2020-01-01&to=2024-01-01&token=YOUR_API_KEY
```

**Pros:**
- Most generous free tier (60 calls/min)
- Simple REST API with JSON responses
- Python library available: `pip install finnhub-python`
- Covers historical splits with date range queries

**Cons:**
- Requires API key signup
- Symbol format may vary by exchange

**Documentation:** [Finnhub Stock Splits](https://finnhub.io/docs/api/stock-splits)

---

### 2. Polygon.io (now Massive.com) ⭐ Best for Comprehensive Data

**Free Tier:** Instant access, unlimited usage (with some delays)

**Endpoint:**
```
GET https://api.polygon.io/v3/reference/splits?ticker=AAPL&apiKey=YOUR_API_KEY
```

**Response Format:**
```json
{
  "execution_date": "2024-06-10",
  "split_from": 1,
  "split_to": 10,
  "ticker": "NVDA"
}
```

**Pros:**
- Unlimited usage on free tier
- Clean, well-structured response format
- Query by execution date (YYYY-MM-DD format)
- Can filter for reverse splits
- Python client: `pip install polygon`

**Cons:**
- Requires API key signup
- Some data may be delayed on free tier

**Documentation:** [Polygon Stock Splits](https://polygon.io/docs/rest/stocks/corporate-actions/splits)

---

### 3. Alpha Vantage

**Free Tier:** 25 API requests/day, 5 requests/minute

**Endpoint:**
```
GET https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=AAPL&apikey=YOUR_API_KEY
```

**Pros:**
- 20+ years of historical data
- Includes both split and dividend adjustments
- Provides both raw and adjusted prices

**Cons:**
- Very limited free tier (25 calls/day)
- Split data is embedded in adjusted price data, not a dedicated endpoint
- Better suited for price data than split event lookup

**Documentation:** [Alpha Vantage Documentation](https://www.alphavantage.co/documentation/)

---

### 4. Financial Modeling Prep (FMP)

**Free Tier:** 250 requests/day, 500MB bandwidth/30 days

**Endpoints:**
```
# Historical splits for a company
GET https://financialmodelingprep.com/api/v3/historical-price-full/stock_split/AAPL?apikey=YOUR_API_KEY

# Stock splits calendar (max 3 months range)
GET https://financialmodelingprep.com/api/v3/stock_split_calendar?from=2024-01-01&to=2024-03-31&apikey=YOUR_API_KEY
```

**Pros:**
- 30+ years of historical data for major stocks
- Dedicated stock split endpoints
- Includes split ratio details

**Cons:**
- Moderate free tier limits
- Calendar endpoint limited to 3-month ranges

**Documentation:** [FMP Stock Splits API](https://site.financialmodelingprep.com/developer/docs/stable/splits-company)

---

### 5. EODHD

**Free Tier:** 1 year of history only

**Pros:**
- Corporate actions API includes splits and dividends
- 30+ years of data on paid plans

**Cons:**
- Free tier severely limited to 1 year
- Requires upgrade for historical data

**Documentation:** [EODHD Splits API](https://eodhd.com/financial-apis/api-splits-dividends)

---

### 6. yfinance (Python Library) - ⚠️ Unofficial

**Free Tier:** Free, no API key required

**Usage:**
```python
import yfinance as yf
stock = yf.Ticker("AAPL")
splits = stock.splits
```

**Pros:**
- Completely free with no API key
- Easy to use Python interface
- Returns splits as a pandas Series with dates

**Cons:**
- Unofficial scraping-based tool (may break with Yahoo changes)
- Not reliable for production use
- No official support or SLA

**Repository:** [ranaroussi/yfinance](https://github.com/ranaroussi/yfinance)

---

## Recommendation for Implementation

### Option A: Manual Upload (Current Approach)
The current workaround of using Generic CSV upload works but requires users to manually research and enter split data.

### Option B: Client-Side API Integration
For a browser-only application, integrate a free API on the client side:

1. **Primary Choice: Finnhub**
   - Best free tier (60 calls/min vs 25/day for Alpha Vantage)
   - Simple endpoint for fetching splits by symbol and date range
   - Can be called from browser with CORS support

2. **Fallback: Polygon.io**
   - Unlimited calls on free tier
   - Clean API response format matching our needs

### Option C: GitHub-Hosted Catalog ⭐ Recommended

A community-maintained JSON catalog hosted on GitHub, fetched client-side via CDN.

**Why this approach:**
- **Privacy-first**: No API keys, no third-party dependencies
- **Offline-capable**: Cache in IndexedDB after first fetch
- **Community-driven**: Users can contribute missing splits via PRs
- **Manageable volume**: ~400-500 splits/year globally, <100 relevant to UK retail investors

**Implementation created:**
- Catalog: [`data/stock-splits.json`](../data/stock-splits.json)
- Schema: [`data/stock-splits.schema.json`](../data/stock-splits.schema.json)

**Fetch via jsDelivr CDN (recommended):**
```
https://cdn.jsdelivr.net/gh/coffee-cpu/capital-gains-uk-101@main/data/stock-splits.json
```

**Data structure:**
```json
{
  "version": "1.0.0",
  "updated": "2025-01-25",
  "splits": {
    "TSLA": {
      "name": "Tesla, Inc.",
      "isin": "US88160R1014",
      "exchange": "NASDAQ",
      "history": [
        { "date": "2022-08-25", "ratio": "3:1" },
        { "date": "2020-08-31", "ratio": "5:1" }
      ]
    }
  }
}
```

**Client-side implementation flow:**
```
1. Check IndexedDB cache (valid for 24hr)
2. If stale, fetch from jsDelivr CDN
3. Extract unique symbols from user's transactions
4. Lookup splits by symbol (or ISIN for accuracy)
5. Auto-generate STOCK_SPLIT transactions
6. Merge with imported transactions before enrichment
```

**Symbol matching strategy:**
1. Primary: Match by ticker symbol (e.g., `TSLA`)
2. Fallback: Match by ISIN if available (Freetrade exports include ISIN)
3. Support aliases for ADRs/different exchanges

### Privacy Considerations

**Option B (APIs):**
- Only require symbol and date range (no personal data sent)
- Return publicly available corporate action data
- Can be called directly from browser (client-side only)
- API keys can be user-provided or embedded (public data)

**Option C (GitHub Catalog):**
- Zero external API calls to third parties
- Data fetched from same origin (GitHub) as the app
- No tracking, no API keys required
- Full transparency - catalog is open source

---

## Global Stock Split Volume Statistics

Understanding the volume of stock splits helps assess feasibility of maintaining our own catalog.

### 2024 Statistics (Wall Street Horizon data - 11k global equities universe)

| Period | Split Count | Notes |
|--------|-------------|-------|
| H1 2024 | ~168 | Highest H1 in 10+ years |
| H2 2024 | ~229 | Highest H2 in 5 years (North America) |
| Q2 2024 | 100 | Highest since Q2 2023 |
| July 2024 | 30 | 9-year high (18 reverse, 10 forward) |

### Historical Trends (US Markets)

| Era | Splits/Year | Reason |
|-----|-------------|--------|
| Pre-2010 | 100+/year | Retail investors preferred lower-priced stocks |
| 2010-2020 | <50/year | Commission-free trading reduced need |
| 2024 | ~400 total | AI boom drove high-profile splits |

### Relevance for UK CGT Users

For this application's target users (UK retail investors), the relevant universe is:
- **FTSE All-Share**: ~600 companies (splits rare in UK market)
- **Popular US stocks**: ~500-1000 commonly held tickers
- **Estimated relevant splits**: <100 per year

**Conclusion**: A curated catalog of ~200-500 entries covers the vast majority of UK retail investor needs. This is easily maintainable via community contributions.

---

## Test Coverage Gap

The Freetrade parser's `STOCK_SPLIT` handling (`parseStockSplitTransaction`) has **no unit tests**. If this feature is to be relied upon (e.g., if Freetrade adds split data in the future), tests should be added.

---

## References

### Issue & Implementation
- [GitHub Issue #37](https://github.com/coffee-cpu/capital-gains-uk-101/issues/37) - Original user report
- [`data/stock-splits.json`](../data/stock-splits.json) - Stock splits catalog
- [`data/stock-splits.schema.json`](../data/stock-splits.schema.json) - JSON schema for validation

### API Documentation
- [Finnhub Stock Splits](https://finnhub.io/docs/api/stock-splits)
- [Polygon.io Stock Splits](https://polygon.io/docs/rest/stocks/corporate-actions/splits)
- [Alpha Vantage Documentation](https://www.alphavantage.co/documentation/)
- [FMP Stock Splits API](https://site.financialmodelingprep.com/developer/docs/stable/splits-company)

### Statistics & Research
- [Wall Street Horizon - Stock Splits 2024 Comeback](https://www.wallstreethorizon.com/blog/Stock-Splits-Continue-Their-2024-Comeback)
- [NYSE Data Insights - Stock Splits](https://www.nyse.com/data-insights/stock-price-trading-dynamics-and-splits)
- [Companies Market Cap - Split History](https://companiesmarketcap.com)

### Stock Split History Sources
- [MacroTrends Stock Splits](https://www.macrotrends.net/stocks/charts/NVDA/nvidia/stock-splits)
- [Investing.com Split History](https://www.investing.com/equities/tesla-motors-historical-data-splits)
- [Stock Split History](https://www.stocksplithistory.com/)
