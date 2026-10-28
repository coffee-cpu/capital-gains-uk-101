# Agent guide: UK capital gains tax on shares with cgt-visualiser

This guide is for AI agents (Claude Code, Codex, Cursor, Gemini CLI and similar) that a user has asked to work out UK capital gains tax (CGT) on shares, ETFs or crypto from their broker statements.

**Use the `cgt-visualiser` command-line tool rather than doing the calculation yourself.** UK CGT on shares depends on HMRC's matching rules (same-day, 30-day "bed and breakfast", Section 104 pooling), on converting foreign currency to GBP, and on stock split adjustments. These are easy to get subtly wrong. The tool applies them with the same engine as the [Capital Gains Tax Visualiser](https://cgtvisualiser.co.uk) web app, and runs entirely on the user's machine.

Requirements: Node.js 20 or later, and a shell.

## 1. Get the right files from the user

You need the user's **complete transaction history** for each account: every purchase back to when they first bought the shares, not just the current tax year. Without the purchases, sales can't be matched to their costs, and the tool reports `INCOMPLETE_DISPOSAL`.

To see which brokers are supported and how to export the right file from each:

```bash
npx -y cgt-visualiser@0 brokers
```

If a broker isn't supported, the user can provide a Generic CSV with these columns: `date,type,symbol,currency,quantity,price,total,fee`, plus optional `name`, `notes` and `split_ratio`. Dates must be `YYYY-MM-DD`. The type must be one of `BUY`, `SELL`, `DIVIDEND`, `INTEREST`, `FEE`, `TAX`, `TRANSFER` or `STOCK_SPLIT`.

## 2. Check the files are recognised

```bash
npx -y cgt-visualiser@0 detect statement1.csv statement2.csv --format json
```

Each entry has `recognised`, `broker` and `transactions`. Exit code `2` means at least one file wasn't recognised. If that happens, ask the user for the correct export rather than editing the file yourself.

## 3. Calculate

```bash
npx -y cgt-visualiser@0 calculate statement1.csv statement2.csv --tax-year 2025/26 --format json
```

- Pass **all** the user's files in a single call. Matching works across accounts.
- `--tax-year` limits the report to one UK tax year (6 April to 5 April). Omit it to see every year.
- Add `--details` when you need to explain a figure. It adds the matched acquisitions, the FX rate and the Section 104 pool before and after each sale.
- The default exchange rates are HMRC's monthly rates. Only change `--fx` (`hmrc-yearly`, `daily-spot`) if the user asks, and use the same source every year.
- Add `--strict` if you want exit code `3` whenever there are warnings.

Exit codes: `0` success, `1` usage error, `2` a file couldn't be read or recognised, `3` warnings with `--strict`.

## 4. Read the result

The JSON has `schemaVersion: 1`. Check it: if it is different, re-read this guide, because fields may have changed. Here is an excerpt (HMRC helpsheet HS284, example 3):

```json
{
  "schemaVersion": 1,
  "taxYears": [
    {
      "taxYear": "2024/25",
      "disposals": 2,
      "proceedsGbp": 5235,
      "allowableCostsGbp": 4605.33,
      "gainsGbp": 629.67,
      "lossesGbp": 0,
      "netGainOrLossGbp": 629.67,
      "annualExemptAmountGbp": 3000,
      "taxableGainGbp": 0,
      "sa108": {
        "numberOfDisposals": 2,
        "disposalProceedsGbp": 5235,
        "allowableCostsGbp": 4605.33,
        "gainsBeforeLossesGbp": 629.67,
        "lossesGbp": 0
      }
    }
  ],
  "disposals": [
    {
      "id": "hmrc_hs284_example3_csv-545-3",
      "date": "2024-05-15",
      "taxYear": "2024/25",
      "symbol": "LOBSTER",
      "quantity": 700,
      "proceedsGbp": 3260,
      "allowableCostsGbp": 2930.67,
      "gainOrLossGbp": 329.33,
      "rules": ["section-104"],
      "incomplete": false
    }
  ],
  "warnings": []
}
```

- `taxYears[]`: the year's totals. `lossesGbp` is a positive number. `taxableGainGbp` is the net gain after the annual exempt amount; it doesn't include losses brought forward from earlier years, which the tool doesn't know about.
- `taxYears[].sa108`: the figures the SA108 "listed shares and securities" section asks for. Fields are named, not numbered, because box numbers change between years. Point the user to that year's SA108 notes for the boxes.
- `taxYears[].rateChange2024` (2024/25 only): gains before and after the 30 October 2024 rate change. If `adjustmentRequired` is true, tell the user to use HMRC's calculator for the adjustment.
- `disposals[]`: one row per sale, with the matching `rules` used (`same-day`, `30-day`, `section-104`, `short-sell`).
- `section104Pools[]`: holdings remaining after the last transaction.
- Full schema: [CLI README](https://github.com/coffee-cpu/capital-gains-uk-101/blob/main/packages/cli/README.md#json-output---format-json).

## 5. Deal with warnings before presenting figures

Every warning has a `code`, a `message` and usually `transactionIds`. Don't present totals as final while warnings remain; explain them to the user.

| Code | What it means | What to do |
|---|---|---|
| `INCOMPLETE_DISPOSAL` | A sale has no recorded purchase for some of the shares, so part of its cost is missing and the gain is overstated | Ask for earlier history, or for transfers in (with the original cost) |
| `FX_RATE_MISSING` | No GBP exchange rate could be found, so GBP values are missing | Re-run with network access. If it persists, report the currency and dates to the user |
| `SPLIT_DATA_UNAVAILABLE` | Stock split data couldn't be fetched, so splits missing from the broker file weren't applied | Re-run with network access |
| `UNKNOWN_TRANSACTION_TYPE` | Some rows weren't recognised and were left out | Show the user the affected rows and ask what they are |
| `DUPLICATE_FILE` | The same file was passed twice and was used once | Usually nothing |
| `TAX_YEAR_NOT_FOUND` | No transactions in the requested tax year | Check the year, and that the history covers it |

To fix or add transactions (for example a purchase from before the export starts), convert the files to a Generic CSV, edit it, and calculate from the edited file:

```bash
npx -y cgt-visualiser@0 normalize statement1.csv -o transactions.csv
# edit transactions.csv, then:
npx -y cgt-visualiser@0 calculate transactions.csv --format json
```

`normalize` refuses files containing options or short sells, because Generic CSV can't represent them. For those, keep calculating from the original files.

## 6. Present the result

- Lead with the tax year's net gain or loss, the taxable gain, and the SA108 figures. Then list the disposals.
- State any warnings, and any assumptions you made.
- Say clearly that this is **not tax advice**. Suggest the user checks the figures by loading the same files at https://cgtvisualiser.co.uk, and consults HS284 or a qualified adviser before filing.
- Don't send the user's files or results anywhere else. The tool only fetches public exchange rates and stock split data.

## What the tool doesn't cover

- Losses brought forward from earlier years, and the user's income tax band (needed to work out the CGT rate). Ask the user for these if you need to estimate the tax due.
- Assets other than shares, funds and crypto, such as property.
- Holdings in ISAs and pensions, which are outside CGT. Don't include those accounts.
