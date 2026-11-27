# HMRC rules check

Our own regular check that the calculator still follows HMRC's published guidance and the legislation: the
matching rules in the engine, and every HMRC figure it uses (allowances, rates, reporting limits). HMRC hasn't
reviewed or approved this calculator. Each check is recorded below, newest first. The date of the newest one
is `HMRC_RULES_CHECK_DATE` in `src/lib/cgt/hmrcRulesCheck.ts`, which the app shows ("HMRC rules and allowances checked …").
Change that date only as part of a check recorded here.

An amount stays in force until a Finance Act changes it. A check confirms the tax years that had ended by its date;
for the current year it confirms only the law as it stood that day, since a Budget can still change it. The app's
footer names the last tax year to have ended and says whether the latest check confirms it. Check again after each Budget and each 6 April, and at least monthly.

`.github/workflows/hmrc-rules-check.yml` runs this check on the 1st of each month and on 7 April (or on demand from the Actions tab) and
opens a PR with the new entry. It moves the date only when everything matches; a person reviews and merges the PR.
Each run starts from `main` and replaces the `chore/hmrc-rules-check` branch, so a check PR that isn't merged is replaced by
the next month's.

HMRC exchange rates are not part of the check: a weekly workflow keeps the bundled rates up to date
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
  disposal, since leftovers usually mean missing history. Not yet decided. Re-checked 2026-11-27: still stands
  (HS284 2026: "If these rules fail to exhaust the shares disposed of, the remaining shares are matched with later
  acquisitions, taking the earliest one first.").
- **Savings rates rise for 2027/28** (found 2026-11-27). Budget 2026 Annex A (updated 5 November 2026) gives savings
  basic/higher/additional rates of 20%/40%/45% for 2026 to 2027 and 24%/44%/49% for 2027 to 2028. The interest help
  text (`IncomeDetailsPanels.tsx`, `helpContent.ts` `interest`) gives 20%/40%/45% with no tax year, and calls them
  "your income tax rate". Correct for 2026/27 and earlier; needs a per-year rate before 6 April 2027 (and once
  the Finance Act enacts it).

## Checks

<!-- Newest first. The newest plain "### YYYY-MM-DD" heading must equal HMRC_RULES_CHECK_DATE. A check that found a
problem is headed "### YYYY-MM-DD (needs attention)" and doesn't move the date. -->

### 2026-11-27

Result: rules and figures match HMRC and legislation.gov.uk as published on this date for 2026/27 and earlier,
with the open findings above. This is a second check on the same date, after Budget 2026.

Matching rules:
- Worked-example and engine tests pass: 15 end-to-end; `src/lib/cgt` and `src/guides` 231 passed, 1 skipped
  (18 files).
- HS284 2026 (updated 6 April 2026, still the latest edition): order is same day, then "the 30 days following the
  day of disposal ... provided the person making the disposal was resident in the UK at the time of the
  acquisition", then the Section 104 holding, then later acquisitions earliest first. Example 2 (Mr Schneider:
  9,500 held, 4,000 sold 30 August 2025 for £6,000, 500 bought 11 September 2025 for £850, proceeds £750, loss
  £100) matches the test. Example 3 2026 PDF (Lobster plc): pool £4,150, then £6,280; costs £2,931 and £1,675;
  gains £329 and £300, the same figures as the test. (Its introduction says the second sale was in "February 2025";
  its Step 4 says "February 2026".)
- CG51560, CG51575, CG51700 (each shows "updated 25 November 2026"): same-day, 30-day (with the non-resident
  exception), Section 104 pooling and reorganisation rules are unchanged from what the engine applies.
- TCGA 1992 (legislation.gov.uk, up to date to 26-27 November 2026): s104 last amended 2014 (FA 2014, subsection
  (4A)), s105 and s106A 2013, s127 2020. The only outstanding effects listed are the long-standing FA 2002 Sch 16
  and FA 2016 s15 entries; nothing new or prospective.
- Manual references (`git grep`): CG51560, CG51575, CG51700, CG54224, CG54900 and CG78310 exist and cover what they're
  cited for. CG51127, CG51500P, CG51620 and CG51730 appear only in this log.

Figures (all match):
- Annual exempt amount 2021/22 to 2026/27: £12,300, £12,300, £6,000, £3,000, £3,000, £3,000 (gov.uk, updated
  13 April 2026). TCGA 1992 s1K(2) "£3,000"; s1K(3) omitted by FA 2025; the new FA 2026 amendment (s1K(6)(a)) doesn't
  touch the individual's amount. Budget 2026 Annex A: £3,000 for 2027/28.
- CGT rates for shares: 10%/20%, 18%/24% from 30 October 2024, 18%/24% for 2025/26 and 2026/27. Budget 2026 Annex A:
  18%/24% for 2027/28, so no later change. (Its CGT measures, a lower Business Asset Disposal Relief limit and a new
  Founders' Relief from April 2027, are reliefs the calculator doesn't apply.)
- SA108 Notes 2026 (re-issued 13 May 2026), CGN 1: "worth more than £50,000"; gains "more than £3,000". SA100 2026
  box 6: "Foreign dividends (up to £500)". No 2027 editions yet.
- Dividend allowance £1,000 (2023/24), £500 (2024/25 to 2026/27); rates 8.75/33.75/39.35% to 2025/26,
  10.75/35.75/39.35% for 2026/27 (gov.uk, updated 6 April 2026). Budget 2026 Annex A: the same for 2027/28.
  Self Assessment needed over £10,000.
- Personal Savings Allowance £1,000 / £500 / £0; savings rates 20% / 40% / 45% for 2026/27. New since the last
  check: Budget 2026 raises savings rates to 24% / 44% / 49% from 2027/28 (see open findings).

Not compared: figures older than the live gov.uk tables (annual exempt amount before 2021/22, dividend figures
before 2023/24).

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
