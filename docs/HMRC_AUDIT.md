# HMRC audit

A regular check that the calculator still follows HMRC: the matching rules in the engine, and every HMRC figure it
uses (allowances, rates, reporting limits). Each audit is recorded below, newest first. The date of the newest one
is `HMRC_AUDIT_DATE` in `src/lib/cgt/hmrcAudit.ts`, which the app shows ("HMRC rules and allowances checked …").
Change that date only as part of an audit recorded here.

An amount stays in force until a Finance Act changes it, so an audit confirms the tax year it was done in and
earlier ones as the law stood that day. Audit again after each Budget and each 6 April, and at least monthly.

`.github/workflows/hmrc-audit.yml` runs this audit on the 1st of each month (or on demand from the Actions tab) and
opens a PR with the new entry. It moves the date only when everything matches; a person reviews and merges the PR.
Each run starts from `main` and replaces the `chore/hmrc-audit` branch, so an audit PR that isn't merged is replaced by
the next month's.

HMRC exchange rates are not part of the audit: a weekly workflow keeps the bundled rates up to date
(`scripts/vendor-hmrc-rates.mjs`).

## Checklist

### Matching rules

1. Run the tests that check the engine against HMRC's worked examples, and the engine's unit tests:
   `npx playwright test e2e/hmrc-worked-examples.spec.ts e2e/same-day-netting.spec.ts e2e/thirty-day-multiple-sells.spec.ts`
   and `npx vitest run src/lib/cgt src/guides`. All must pass.
2. Compare the latest HS284 helpsheet (its matching order table, Example 2 and the Example 3 PDF) with
   `e2e/hmrc-worked-examples.spec.ts`. Note any new edition, new example or changed figure.
   https://www.gov.uk/government/publications/shares-and-capital-gains-tax-hs284-self-assessment-helpsheet
3. Read the identification pages for changes to the rules the engine applies (`src/lib/cgt/`):
   [CG51560](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560) (same day, 30 days),
   [CG51575](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51575) (Section 104 holding),
   [CG51700](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51700) (share reorganisations).
4. Check TCGA 1992 [s104](https://www.legislation.gov.uk/ukpga/1992/12/section/104),
   [s105](https://www.legislation.gov.uk/ukpga/1992/12/section/105),
   [s106A](https://www.legislation.gov.uk/ukpga/1992/12/section/106A) and
   [s127](https://www.legislation.gov.uk/ukpga/1992/12/section/127) for amendments in force or prospective.
5. Check that every HMRC manual page cited in the code and docs (links and bare references, including the tracked
   `.claude/` files) still exists and covers what it's cited for:
   `git grep -nE -i "capital-gains-manual/cg|CG5[0-9]{4}" -- . ':!.claude/worktrees'`.

### Figures

| Where in the code | What | Source |
|---|---|---|
| `allowances.ts` `ANNUAL_EXEMPT_AMOUNTS` | CGT annual exempt amount by year | [CGT rates and allowances](https://www.gov.uk/government/publications/rates-and-allowances-capital-gains-tax/capital-gains-tax-rates-and-annual-tax-free-allowances), [TCGA 1992 s1K](https://www.legislation.gov.uk/ukpga/1992/12/section/1K) |
| `taxYearFeatures/cgtRateChange2024.ts` | CGT rates for shares (10%/20% to 18%/24% from 30 October 2024), and no later change | CGT rates and allowances (as above) |
| `reporting.ts` | SA108 limits: £50,000 proceeds, or gains over the annual exempt amount (CGN 1 of the latest notes) | [SA108](https://www.gov.uk/government/publications/self-assessment-capital-gains-summary-sa108) |
| `reporting.ts` `SA100_FOREIGN_DIVIDENDS_LIMITS` | SA100 box 6 "Foreign dividends (up to £X)"; add each new return's year | [SA100](https://www.gov.uk/government/publications/self-assessment-tax-return-sa100) |
| `allowances.ts` `DIVIDEND_ALLOWANCES`, `DIVIDEND_TAX_RATES` | Dividend allowance and rates | [Income Tax rates and allowances](https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past) |
| `IncomeDetailsPanels.tsx`, help text | Dividends over £10,000 need Self Assessment | [How to report tax on dividends](https://www.gov.uk/tax-on-dividends/how-to-report-tax-on-dividends) |
| `IncomeDetailsPanels.tsx`, help text | Personal Savings Allowance (£1,000 / £500 / £0), savings rates (20% / 40% / 45%) | [How much is tax free](https://www.gov.uk/apply-tax-free-interest-on-savings/how-much-is-tax-free) |

## Open findings

- **Shares sold beyond what the rules match** (found 2026-11-27). HS284 matches them with later purchases, earliest
  first. The engine does that only for sales the broker marks as short sells; otherwise it flags an incomplete
  disposal, since leftovers usually mean missing history. Not yet decided.

## Audits

<!-- Newest first. The newest plain "### YYYY-MM-DD" heading must equal HMRC_AUDIT_DATE. An audit that found a
problem is headed "### YYYY-MM-DD (needs attention)" and doesn't move the date. -->

### 2026-11-27

Result: rules and figures match HMRC as published on this date, with the open finding above.

Matching rules:
- Worked-example and engine tests pass (15 end-to-end, 459 unit).
- HS284 2026 edition: matching order is same day, then the 30 days after (UK residents only), then the Section 104
  holding, then later acquisitions earliest first. Example 2 (2025 edition: Mesopotamia plc; 2026: unnamed, dates a
  year later) and Example 3 (Lobster plc, gains £329 and £300) have the same figures as in the tests.
- CG51560, CG51575, CG51700: no change to the rules the engine applies.
- TCGA 1992 s105 and s106A: no amendment since 2013.
- References fixed: CG51620 (corporation tax) replaced with CG51575 (individuals); CG51127 (no longer exists) with
  CG51700; CG51500P (archived) removed; CG51730 (a definitions page, cited in the help for stock splits) with
  CG51700. CG54224 and CG54900 (gilts guide) checked and correct. `.claude/review-instructions.md` updated too.
- The 30-day rule doesn't apply to non-residents: the help text and spec now say the calculator assumes the user was
  UK resident throughout.

Figures (all match):
- Annual exempt amount 2021/22 to 2026/27: £12,300, £12,300, £6,000, £3,000, £3,000, £3,000. No uprating
  provision from 2025/26 (TCGA 1992 s1K(3) omitted by Finance Act 2025).
- CGT rates for shares: 10%/20%, then 18%/24% from 30 October 2024; 18%/24% for 2025/26 and 2026/27.
- SA108 Notes 2026: £50,000 proceeds, gains over £3,000. SA100 2026 box 6: "up to £500".
- Dividend allowance £1,000 (2023/24), £500 (2024/25 onwards); rates 8.75/33.75/39.35%, 10.75/35.75/39.35% from
  2026/27; Self Assessment over £10,000.
- Personal Savings Allowance £1,000 / £500 / £0; savings rates 20% / 40% / 45%.

Not compared: figures older than the live gov.uk tables (annual exempt amount before 2021/22, dividend figures
before 2023/24).
