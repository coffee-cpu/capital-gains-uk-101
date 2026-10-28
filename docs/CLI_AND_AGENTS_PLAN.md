# Plan: CLI and AI-agent support

**Status:** Agreed · **Date:** 2026-10-27

## Goal

Let people (and the AI agents working for them) run the same CGT calculation
the web app does, from a terminal, without the data leaving their machine:

```bash
npx cgt-visualiser calculate schwab.csv trading212.csv --tax-year 2025/26
```

Agents such as Claude Code, Codex, Cursor and Gemini CLI can already run shell
commands, so a CLI with a JSON output mode plus a published instructions page
makes us usable by agents. Today an agent asked to "do my UK share CGT" either
does the maths itself, which is error-prone, or writes a one-off script.

An MCP server is a later, thin wrapper over the same core (Phase 4).

## Principles

- **One engine.** The CLI and the web app call the same parsing, enrichment and
  CGT code, so results must be identical. There is no separate CLI fork.
- **The web app's behaviour doesn't change.** Phase 1 is a pure refactor.
- **Privacy is unchanged.** No telemetry. The only network calls are the ones the
  web app already makes: FX rates, and stock-split data from jsDelivr. An
  `--offline` flag disables them.
- **Agent-friendly by design.** Stable, versioned JSON output, meaningful exit
  codes, explicit warnings, and help text that is self-explanatory.

## Current coupling (what blocks a CLI today)

| Area | Problem | Where |
|---|---|---|
| File reading | Preprocessors take a browser `File` and read it with `FileReader`, which doesn't exist in Node. `Blob.text()` isn't an option: jsdom 27, used by our unit tests, doesn't implement it. | `src/lib/parsers/fileUtils.ts`, `interactiveBrokers.ts`, `coinbase.ts`, `src/lib/csvParser.ts` |
| Import flow | Preprocess, parse, detect, parse to GenericTransaction, then normalise symbols. This logic lives in a React component, mixed with IndexedDB duplicate checks and writes. | `src/components/CSVImporter.tsx` (`processFile`) |
| FX cache | Providers read and write `db.fx_rates` (Dexie/IndexedDB) directly. | `src/lib/fx/providers/base.ts`, `hmrcYearly.ts`, `dailySpot.ts` |
| Split cache | `JsDelivrSplitSource` caches in `db.split_data_cache`. | `src/lib/splits/splitDataSource.ts` |
| Pipeline | `processTransactionsFromDB` mixes "load from DB" with the pure pipeline (dedupe, auto-splits, enrich, calculate). | `src/lib/transactionProcessor.ts` |

Already portable: `detectBroker`, all broker parsers (`rows -> GenericTransaction[]`),
`enrichTransactions`, `calculateCGT`, tax-year utilities, and Zod schemas.

## Phase 1: Make the core runtime-agnostic (PR 1, no behaviour change)

1. **Text-based preprocessing.** Change `CSVPreprocessor` to work on strings:
   `matches(text: string): boolean` and `apply(text: string): string`.
   Add `parseCSVText(text)` next to `parseCSV(file)`. The browser reads the file
   once (`FileReader` stays in a tiny browser-only helper) and passes the text down.
2. **Extract `importCSVText(text, fileName)`** into a new module,
   `src/lib/import.ts`. It runs preprocess, parse, detect (with the 0.8
   confidence threshold), the parser and `normalizeTransactionSymbols`, and
   returns `{ broker, transactions }` or throws a typed error.
   `CSVImporter.tsx` keeps only the DB-specific parts (duplicate-file check,
   `imported_files`, `bulkAdd`).
3. **Cache abstraction.** Add a small `KeyValueCache<T>` interface (`get`/`put`).
   - `DexieFxRateCache` / `DexieSplitCache` for the web (current behaviour).
   - `JsonFileCache` (under `~/.cache/cgt-visualiser/` or `$XDG_CACHE_HOME`) and
     `MemoryCache` for the CLI.
   - Inject the cache through the provider and split-source constructors. The web
     defaults to Dexie, so call sites don't change. `src/lib/db.ts` must not be
     imported by anything the CLI bundles.
4. **Split `processTransactionsFromDB`** into `loadTransactionsFromDB()` and a pure
   `runPipeline(transactions, { fxSource, autoSplits, splitSource })`.
5. **Tests.** Existing unit and E2E tests must pass unchanged. Add unit tests for
   `importCSVText` (using fixtures from `e2e/fixtures/`) and for the cache
   implementations.

## Phase 2: The CLI (PR 2)

**Packaging** (same layout as `coffee-cpu/vibe-coding-stats`)
- An npm workspace at `packages/cli`, with its own `package.json` (name
  `cgt-visualiser`, a `bin` entry, `files: ["dist"]`, `engines.node >= 20`).
  The root `package.json` stays the private web app and gains
  `"workspaces": ["packages/*"]`.
- The CLI imports the shared engine from `../../src/lib` and is bundled with
  esbuild into `packages/cli/dist/cli.js`. Bundling keeps the install small and
  avoids shipping React, Dexie and so on. `papaparse` and `zod` are bundled in
  too, so the published package has no runtime dependencies.
- Argument parsing uses `node:util` `parseArgs`, so no extra dependency is
  needed. Minimum Node version is 20, for global `fetch`.
- The npm name `cgt-visualiser` is currently free (checked 2026-10-27).

**Commands**

| Command | Purpose |
|---|---|
| `calculate <files...>` | Full pipeline. Flags: `--tax-year 2025/26` (default: all years), `--fx hmrc-monthly\|hmrc-yearly\|daily-spot` (default `hmrc-monthly`, same as web), `--no-auto-splits`, `--offline`, `--format text\|json\|csv` (default `text` on a TTY, `json` otherwise), `--details` (per-disposal match breakdown) |
| `detect <files...>` | Show the detected broker, confidence and row count for each file, without calculating. Useful for an agent's first step. |
| `brokers` | List supported formats, with the export instructions from each `BrokerDefinition`. |
| `normalize <files...> -o out.csv` | Write the Generic CSV (reuses `src/utils/csvExport.ts`), so users or agents can fix or add rows and re-run. This mirrors the web app's documented correction workflow. |

**Output contract (`--format json`)**
- Top level: `schemaVersion: 1`, `inputs` (file to broker mapping),
  `fxSource`, `taxYears[]` (from `TaxYearSummary`: disposals count, proceeds,
  allowable costs, gains, losses, net, annual exempt amount, taxable gain),
  `disposals[]`, `section104Pools` (closing holdings), and `warnings[]`.
- **Detail levels.** By default each disposal is one compact row: date, symbol,
  quantity, proceeds, allowable cost, gain or loss, and the rules used
  (same-day, 30-day, S104). That's enough to answer "what's my gain" and to
  spot-check, and it stays small for an agent's context. `--details` adds the
  full audit trail: each matched acquisition, the pool state before and after,
  FX rates used, and split adjustments. Totals are identical in both modes.
- Warnings are machine-readable (`code`, `message`, `transactionIds`). Examples:
  a disposal with no matching acquisition (an incomplete history), a missing FX
  rate, an `UNKNOWN` transaction type, or a file that was skipped.
- **SA108 figures (v1).** Each tax year includes an `sa108` block with the
  figures the form's listed shares and securities section asks for: number of
  disposals, disposal proceeds, allowable costs, gains before losses, and
  losses. Fields have descriptive names, not box numbers. The 2024/25
  rate-change adjustment from `taxYearFeatures/cgtRateChange2024.ts` is
  included where it applies.
- **Box numbers (later).** Box numbers change between tax years, and 2024/25
  already differs. A wrong box number is worse than none, so box numbers come in
  a later minor release: a per-tax-year mapping table, with each year checked
  against that year's SA108 notes and covered by tests.

**Exit codes:** `0` success, `1` usage error, `2` a file couldn't be
recognised or parsed, `3` calculated with warnings (only with `--strict`).

**Tests:** CLI integration tests run `calculate` on `e2e/fixtures/*` in
`--offline` mode, with a seeded FX cache so CI makes no network calls. They
assert that the totals match those from the web pipeline (`runPipeline`) for the
same inputs. Add a CI job: `npm run build:cli` plus a smoke test.

## Phase 3: Agent instructions and launch (PR 3)

1. **`public/llms.txt`.** A short description of the site following the llms.txt
   convention: what the tool does, its privacy model, and links to the agent
   guide and HMRC references.
2. **Agent guide page** (`public/agents.md`, also linked from the About page).
   It's written as steps an agent can follow:
   - Install and run: `npx cgt-visualiser@<version> …` (pin the version).
   - Which export to download from each broker (generated from the same
     `instructions` the web app shows).
   - Start with `detect`, then `calculate --format json --details`.
   - How to read `warnings` and when to ask the user (for example, an incomplete
     history before the first export, or transfers in).
   - Tell the user to verify the results, for example by loading the same files
     in the browser app, and to consult HS284 or an adviser. Don't call the output
     tax advice.
3. **About page:** a "Use with AI agents" section with the one-line command and a
   link to the guide. Add the new pages to `public/sitemap.xml`, and add a README
   section.
4. **Publish to npm, automatically on tag.** Copy
   `vibe-coding-stats/.github/workflows/publish.yml`: trigger on `v*.*.*` tags,
   use npm trusted publishing (OIDC, `id-token: write`, no stored token),
   fail if the tag doesn't match `packages/cli/package.json`'s version, run the
   tests and build, then `npm publish -w packages/cli --provenance --access public`.
   One-time setup on npmjs.com (repo owner): register this repo and workflow as
   the package's trusted publisher. If npm requires the package to exist first,
   do one manual `npm publish` of the first version.

## Phase 4 (later): MCP server

A thin wrapper, `cgt-visualiser mcp` (stdio), exposing `list_brokers`,
`detect_files`, `calculate_cgt` and `normalize_files` as tools. Each tool calls
the same functions as the CLI, and the JSON output contract is reused as the
tool result schema. It runs locally, so the privacy model is unchanged. Do this
only once the CLI exists and there's demand from users of chat-only clients.

## Risks

- **Divergence between the web and CLI results.** Mitigated by the single engine
  and the parity tests in Phase 2.
- **Agents presenting the output as authoritative.** Mitigated by warnings in the
  JSON, wording in the guide, and the existing disclaimer in `--help` and the
  text output.
- **External API availability** (HMRC mirror, Frankfurter, jsDelivr). This is the
  same exposure as the web app. The CLI's persistent file cache and `--offline`
  reduce repeat calls.
- **Phase 1 touching the import path.** Mitigated by keeping the change
  mechanical and relying on the existing E2E import tests.

## Decisions

1. **npm package name:** `cgt-visualiser`.
2. **Publishing:** the repo owner's npm account. Publishing is automatic on
   version tags, using the same setup as vibe-coding-stats.
3. **Default output:** compact per-disposal rows by default, with the full audit
   trail behind `--details`.
4. **SA108:** v1 outputs the SA108 figures under descriptive names. Box numbers
   come later, checked per tax year.
