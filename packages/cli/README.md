# cgt-visualiser

UK capital gains tax on shares, calculated from your broker's CSV exports. It applies HMRC's share matching rules: same-day, 30-day ("bed and breakfast") and Section 104 pooling. It also handles foreign-currency conversion and stock splits.

It runs on your machine and never uploads your transactions. The calculation engine is the same one used by the [Capital Gains Tax Visualiser](https://cgtvisualiser.co.uk) web app.

```bash
npx cgt-visualiser calculate schwab.csv trading212.csv --tax-year 2025/26
```

Requires Node.js 20 or later.

## Commands

| Command | What it does |
|---|---|
| `calculate <files...>` | Calculate gains and losses for every tax year, or one year with `--tax-year 2025/26` |
| `detect <files...>` | Show which broker format each file is, without calculating |
| `brokers` | List supported brokers and how to export the right file from each |
| `normalize <files...> -o out.csv` | Convert exports into one Generic CSV that you can edit (fix or add rows), then pass to `calculate` |

Run `cgt-visualiser --help` for all options. The main options are:

- `--fx hmrc-monthly|hmrc-yearly|daily-spot`: the exchange rate source. The default is HMRC monthly rates.
- `--details`: for each disposal, show the matched acquisitions, the FX rate used and the Section 104 pool before and after.
- `--format text|json|csv`: the output format. The default is `text` in a terminal and `json` when the output is piped.
- `--offline`: make no network requests and use cached exchange rates only.
- `--strict`: exit with code 3 if there are any warnings.

Exit codes: `0` success, `1` usage error, `2` a file couldn't be read or recognised, `3` warnings with `--strict`.

## Supported brokers

The supported brokers are Charles Schwab (including Equity Awards), Interactive Brokers, Trading 212, Freetrade, EquatePlus, Revolut, Coinbase and Coinbase Pro, plus a Generic CSV format for anything else. Run `cgt-visualiser brokers` for export instructions.

## Privacy

The only network requests are for public reference data: HMRC or ECB exchange rates and stock split data. They never include your transactions. Fetched data is cached in `~/.cache/cgt-visualiser`. Set `CGT_VISUALISER_CACHE_DIR` to use a different directory, or pass `--no-cache` to turn the cache off.

## JSON output (`--format json`)

The output is versioned with `schemaVersion: 1`. New fields may be added within a version. Fields are only removed, renamed or changed in meaning with a new `schemaVersion`.

| Field | Contents |
|---|---|
| `options`, `inputs` | What was calculated, including each file's detected broker and transaction count |
| `taxYears[]` | One entry per year: disposals, proceeds, allowable costs, gains, losses (as a positive number), net gain, annual exempt amount and taxable gain, plus dividend and interest totals |
| `taxYears[].sa108` | The figures the SA108 "listed shares and securities" section asks for. Fields are named rather than numbered because box numbers change between years |
| `taxYears[].rateChange2024` | 2024/25 only: gains and losses before and after the 30 October 2024 rate change, and whether an adjustment is required |
| `disposals[]` | One row per disposal: date, symbol, split-adjusted quantity, proceeds, cost, gain or loss, matching rules used, and an `incomplete` flag. `--details` adds the full audit trail |
| `section104Pools[]` | Holdings remaining after the last imported transaction |
| `warnings[]` | Problems to resolve, each with a `code` and the affected `transactionIds`. Codes: `FX_RATE_MISSING`, `INCOMPLETE_DISPOSAL` (sales with no recorded purchase, often because the history starts too late), `UNKNOWN_TRANSACTION_TYPE`, `DUPLICATE_FILE`, `TAX_YEAR_NOT_FOUND` |

All amounts are in GBP and rounded to the penny.

## Disclaimer

This is not tax advice. Figures are calculated from HMRC guidance and may be wrong or incomplete. Check them, for example by loading the same files in the [web app](https://cgtvisualiser.co.uk), and consult HMRC helpsheet [HS284](https://www.gov.uk/government/publications/shares-and-capital-gains-tax-hs284-self-assessment-helpsheet) or a qualified adviser before filing.

## License

MIT
