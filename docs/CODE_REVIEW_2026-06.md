# Code Review — June 2026

A full-repo review covering correctness, robustness, performance, dead code,
duplication, and documentation staleness. Items marked ✅ were fixed on the
`claude/fable-model-review-v2klc2` branch alongside this report; unmarked items
remain open.

**Health check:** build passes, all 498 unit tests pass. 5 of 65 E2E tests fail
in offline environments because several specs assert exact GBP figures fetched
from live HMRC/ECB rate APIs — the suite is inherently network-dependent.

---

## 1. Correctness bugs that affect computed tax numbers

1. ✅ **Fee apportionment wrong for fractional shares** — `src/lib/cgt/utils.ts:199`
   (duplicated in `engine.ts:133` and `section104Pool.ts:141`):
   `fee_gbp / Math.max(qty * multiplier, 1)` was meant as a divide-by-zero guard,
   but for quantities below 1 (routine on Trading 212 / Freetrade / Revolut) it
   silently understates the fee — buy 0.5 shares with a £1 fee and only £0.50
   reaches the cost basis. Gains overstated. All existing tests used integer
   quantities, so it was never caught.

2. ✅ **Tax year assignment is timezone-sensitive** — `src/utils/taxYear.ts:11-15`
   parsed `'2024-04-06'` as UTC midnight then read it back with local-time
   accessors. For any user west of UTC, a 6 April disposal landed in tax year
   2023/24 instead of 2024/25. Now pure string arithmetic.

3. ✅ **EquatePlus: negative `Net units` became a negative-quantity BUY** —
   `src/lib/parsers/equatePlus.ts:117`: the guard was `!netUnits || netUnits === 0`,
   letting negatives (shares withheld for taxes) through to corrupt the
   Section 104 pool. Now `netUnits <= 0`.

4. **Trading 212 fees converted in the wrong currency** —
   `src/lib/parsers/trading212.ts`: fee columns are reported in the account
   currency (GBP) but attached to a transaction whose `currency` is the
   instrument's price currency (e.g. USD), so FX enrichment converts a GBP fee
   as if it were USD. Proper fix needs a fee-currency field on
   `GenericTransaction` — left open.

5. **Missing FX rate silently becomes a £0 cost basis** —
   `src/lib/cgt/utils.ts:66` falls back `?? 0` with no flag; a failed-FX
   acquisition produces a disposal showing ~100% gain with no warning.

6. **Short-sell matching runs before the same-day rule**
   (`src/lib/cgt/engine.ts:31-36`) and can consume a buy that TCGA92/S105 says
   belongs to a same-day disposal. May be deliberate, but is undocumented and
   deviates from statutory precedence.

## 2. Data-loss and robustness hazards

7. ✅ **Schema migration silently deleted all user data** — `src/lib/db.ts`:
   on any upgrade error, `ensureDatabaseCompatible` called `db.delete()`,
   dropping the transactions table along with the re-fetchable FX cache. Now
   salvages transactions via a dynamic Dexie instance before resetting and
   restores them after.

8. ✅ **A single FX fetch failure was cached forever** — `src/lib/fx/manager.ts:70`
   cached the promise including rejections, with no eviction; one network blip
   and that (date, currency) showed `fx_source: 'Failed'` until reload. Rejected
   promises are now evicted from the cache.

9. **HMRC yearly averages cached with wrong provenance** —
   `src/lib/fx/providers/hmrcYearly.ts:92-121`: when the December calendar-year
   file isn't published yet, the March (tax-year-period) average is written
   under the calendar-year key with no TTL, so the value never updates once the
   December file exists.

10. ✅ **One bad row killed a whole Coinbase Pro import** — `coinbasePro.ts`
    threw on a malformed date where every other parser skips the row. Now skips.

11. `csvParser.ts:26-28` rejects the entire file on any recoverable PapaParse
    row error — open.

## 3. Performance

12. ✅ **CGT matching was O(n²)–O(n³)** — `getRemainingQuantity`
    (`src/lib/cgt/utils.ts`) linearly scanned all matchings across all symbols
    and was called per-sell, per-candidate-buy, and per-match in the 30-day
    matcher. Now uses an incremental `Map<txId, matchedQty>` carried in the
    pipeline context.

13. **TransactionList re-renders the entire table on every mouse hover** —
    hover state at table level plus per-row triple-nested matching scans
    (`TransactionList.tsx:448-465, 674-675`). Needs a precomputed badge map and
    memoized rows — open.

14. **FX enrichment is serial** — `fxEnricher.ts:62-84` awaits one rate per
    transaction; `hmrcMonthly.ts` downloads the same all-currency month file
    once per currency — open.
    ✅ The crypto leak into prefetch (`manager.ts:97-100`), which forced a full
    time-series re-download on every run for Coinbase users, is fixed
    (non-fiat currencies now filtered).

15. ✅ **Bundle**: `recharts` shipped eagerly in the 1.09 MB main chunk while
    used only by two Dashboard charts. Charts are now lazy-loaded
    (`@react-pdf/renderer` already was).

## 4. Dead code and duplication

16. ✅ **Duplicate dead split-normalization module** — `src/lib/splits/normalization.ts`
    duplicated `splitEnricher.ts` almost verbatim, was used only by its own
    tests, and had already drifted. Deleted; tests retargeted at `SplitEnricher`.

17. ✅ **`gain_group` was a lie** — documented as "HMRC matching rule applied"
    (`src/types/transaction.ts`), but every producer hardcoded `'NONE'` and
    nothing read it (the engine populates `match_groups`). Field removed.

18. ✅ **`addTransactions` in the store was dead and booby-trapped**
    (`transactionStore.ts`): never called, hardcoded `tax_year: '2024/25'` and
    `fx_rate: 1`. Removed, along with unused `setHelpContext`.

19. **taxYearFeatures "registry" is three registries** — calculation registry,
    PDF renderer map (features without an entry are silently skipped in PDFs),
    and a hardcoded UI lookup in `TaxYearFeaturesRenderer.tsx:48`. ~270 lines of
    plumbing for one feature — open.

20. **Parsers reimplement shared utils** — date-part extraction exists 5 times
    (three with no validation), `parsingUtils.parseISODate` /
    `extractCurrencyFromAmount` are unused while freetrade/revolut re-implement
    them, freetrade/IB use bare `parseFloat` (a `"1,500"` silently becomes `1`)
    — open.

21. **Other duplication (open)**: same-day and 30-day matchers share a ~40-line
    FIFO loop; currency formatting reimplemented 5+ ways with inconsistent
    output; `TaxYearSummary.tsx` (751 lines) contains two structurally identical
    ~150-line panels; `IssuesPanel` centralizes warnings but the superseded
    per-component banners still render alongside it.

22. **Test-only exports (open)**: `buildDisposalGainsData`, `formatMonthYear`,
    `formatCurrencyPrecise`, `getRuleColor` (chartData),
    `getIncompleteStockPlanActivity`, `parseCSVText`, `getDefaultFXManager`,
    several taxYearFeatures registry helpers.

23. **Parser convention drift (open)**: ID generation deviates from the
    documented `${fileId}-${rowIndex}` pattern in three different ways;
    STOCK_SPLIT ratio extraction inconsistent across brokers (T212/Revolut emit
    splits with no ratio and no `incomplete` flag); default currency
    inconsistent (GBP vs USD); `GenericTransactionSchema` (Zod) is never
    actually enforced at import time despite CLAUDE.md's claim.

## 5. React correctness

24. ✅ **Rules-of-hooks violations** — `TransactionsChart.tsx` and
    `PoolBreakdownChart.tsx` returned early before `useMemo` calls ("rendered
    more hooks" crash hazard). Hooks hoisted above the guards. ESLint with
    `eslint-plugin-react-hooks` added to catch this class of bug
    (`npm run lint`).

25. **`useInitializeSettings` runs an async side effect during render**
    (`settingsStore.ts:100-107`), racing `ensureDatabaseCompatible()` — open.

26. **`setCGTResults` resets the selected tax year** on every FX-source or
    auto-splits change, bouncing the user off the year they were viewing — open.

27. **Settings persisted to both localStorage and IndexedDB** with read-back
    overwrite at startup — two sources of truth — open.

## 6. Stale documentation

28. ✅ **CLAUDE.md "Adding a New Broker Parser"** described the pre-registry
    architecture (detection in `brokerDetector.ts`, routing in `csvParser.ts`,
    samples in nonexistent `test-data/`, tests in nonexistent
    `e2e/import.spec.ts`). Rewritten for the config-driven registry.

29. ✅ **"Bank of England API" was fiction** — repeated in CLAUDE.md,
    SPECIFICATION.md, and a Zod field description. Actual providers: HMRC
    monthly/yearly mirrors and ECB via Frankfurter. Corrected.

30. ✅ **"Two tables" was stale** — `db.ts` is at schema v4 with five tables;
    `fx_rates` hasn't used the `[date+currency]` key since v3. Corrected.

31. ✅ **CLAUDE.md mandated fixing "linter warnings" but no linter existed.**
    ESLint added (`npm run lint`).

32. ✅ **README omitted 3 of 10 supported brokers** (Revolut, Coinbase,
    Coinbase Pro). Added.

33. ✅ **docs/FREETRADE_RESEARCH.md** said "format not yet confirmed" for a
    fully shipped broker; **docs/FEATURE_PLAN_2024-25_ADJUSTMENT.md** listed
    implemented features as missing. Both now carry status headers.

34. **Open doc items**: `docs/SPECIFICATION.md` data model (5-type enum vs 18
    actual types, stale required fields, missing SHORT_SELL, "Framer Motion" /
    "json-schema-to-typescript" never used); `public/BROKER_INSTRUCTIONS.md`
    is an orphaned deployed file covering 4 of 10 brokers;
    `.claude/review-instructions.md` references the long-gone
    `src/lib/enrichment.ts` and is read by no workflow; `docs/ETRADE_RESEARCH.md`
    checklist prescribes the superseded architecture; `currencies.ts` still
    lists HRK (retired 2023); `CodingStats.tsx` calls the GitHub API at runtime
    despite the "no external transmission" framing.

## 7. Parser bugs (open, lower severity)

35. IB non-options "Assignment" rows always map to BUY, discarding the quantity
    sign that distinguishes call vs put assignment (`interactiveBrokers.ts:500`).
36. `parseCurrency(...) || null` coerces a legitimate 0 to null
    (`schwab.ts:90-92`, freetrade, IB).
37. CoinbasePro quote-currency leg placeholder price inconsistent between buy
    (`null`) and sell (`1`) branches.
38. CSVImporter duplicate detection by `startsWith(fileId)` has a
    prefix-collision bug (`abc_csv-12` matches IDs from `abc_csv-123-…`).
39. No floating-point epsilon on "fully matched" checks in the CGT engine —
    fractional/split quantities can leave 1e-13 residues that flag disposals
    as incomplete.
40. Section 104 synthetic acquisition is built by spreading the disposal and
    reading post-mutation pool state — engine totals are right, but consumers
    reading fields off `acq.transaction` get misleading values
    (`section104Pool.ts:161-171`).
