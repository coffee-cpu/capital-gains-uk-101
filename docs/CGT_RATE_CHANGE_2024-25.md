# Capital Gains Tax Rate Change 2024-25

## Overview

On 30 October 2024, the UK government increased Capital Gains Tax (CGT) rates for disposals of most assets (excluding residential property and carried interest). This mid-year rate change creates additional complexity for the 2024-25 tax year calculations.

**IMPORTANT**: HMRC's automatic Self Assessment calculations do NOT account for this in-year rate change. Taxpayers may need to manually calculate and report an adjustment.

## Rate Changes (30 October 2024)

### Assets Affected: "Other Gains" (Shares, Securities, etc.)

| Rate Band | Before 30 Oct 2024 | From 30 Oct 2024 |
|-----------|-------------------|------------------|
| **Basic rate** | 10% | 18% |
| **Higher rate** | 20% | 24% |

### Assets NOT Affected (rates unchanged)

- **Residential property**: Remain at 18% (basic rate) and 24% (higher rate)
- **Carried interest**: Remain at 18% and 28%
- **Business Asset Disposal Relief (BADR)**: Remains at 10%
- **Investors Relief (IR)**: Remains at 10%

## When Adjustment is Required

You need to calculate an adjustment if **ALL** of the following apply:

1. ✅ You disposed of shares/securities in the 2024-25 tax year
2. ✅ You have disposals both **before** and **after** 30 October 2024
3. ✅ Your net gains exceed the Annual Exempt Amount (£3,000 for 2024-25)
4. ✅ The allocation of the Annual Exempt Amount (AEA) or losses affects your tax liability

### You DO NOT need an adjustment if:

- ❌ All disposals were before 30 October 2024
- ❌ All disposals were after 30 October 2024
- ❌ Your total net gain is below the Annual Exempt Amount (£3,000)
- ❌ You only disposed of residential property or carried interest
- ❌ All gains qualify for BADR/IR (10% rate applies throughout)

## HMRC's Automatic Calculation Problem

HMRC's Self Assessment system will calculate CGT using a **single blended rate** for the entire tax year. It cannot split gains into:
- Gains realized **before** 30 October 2024 (at old rates: 10%/20%)
- Gains realized **after** 30 October 2024 (at new rates: 18%/24%)

This means the automatic calculation may be **incorrect** and you must manually adjust.

## Allocation Rules

When calculating the adjustment, you must allocate deductions (Annual Exempt Amount, losses, basic rate band) in the most tax-efficient way.

### 1. Annual Exempt Amount (AEA) Allocation Order

Allocate the £3,000 AEA to gains with the **highest tax rates first**:

1. **Carried interest** (18%/28% throughout the year)
2. **Residential property** (18%/24% throughout the year) OR **Other gains after 30 Oct 2024** (18%/24%)
3. **Other gains before 30 Oct 2024** (10%/20%)
4. **Gains qualifying for BADR/IR** (10% throughout the year)

### 2. Losses Allocation Order

Same as AEA - deduct from highest-rate gains first.

### 3. Basic Rate Band Allocation

The basic rate band (unused portion of your income tax basic rate band) is allocated differently:
- It reduces what's available for later gains
- Gains qualifying for BADR/IR consume basic rate band even if already taxed at 10%

**Example:**
```
Available basic rate band: £5,000
Gains qualifying for BADR: £10,000
Basic rate band available for other gains: £0
```

## Calculation Example

### Scenario:
- Basic rate taxpayer (unused basic rate band: £10,000)
- Gains before 30 Oct 2024: £5,000
- Gains after 30 Oct 2024: £5,000
- Total gains: £10,000
- Annual Exempt Amount: £3,000

### HMRC's Automatic Calculation (INCORRECT):
```
Total gains: £10,000
Less AEA:    -£3,000
Taxable:      £7,000

Tax (assuming 20% blended rate): £7,000 × 20% = £1,400
```

### Correct Calculation with Split:
```
Step 1: Allocate AEA to highest-rate gains (after 30 Oct)
Gains after 30 Oct:  £5,000
Less AEA:            -£3,000
Taxable (24% rate):   £2,000 × 24% = £480

Step 2: Calculate tax on earlier gains (before 30 Oct)
Gains before 30 Oct: £5,000
Taxable (20% rate):  £5,000 × 20% = £1,000

Total tax: £480 + £1,000 = £1,480
```

### Adjustment Required:
```
Correct tax:          £1,480
HMRC automatic tax:   £1,400
Adjustment needed:    +£80 (increase)
```

**Shorter calculation:** £2,000 × (24% - 20%) = £2,000 × 4% = £80

## Where to Report the Adjustment

### SA100 Self Assessment Tax Return

**Box:** "Adjustment to Capital Gains Tax" (optional field)
- If increasing tax: Enter positive number (e.g., `80`)
- If reducing tax: Enter negative number with minus sign (e.g., `-50`)

### Evidence Required

You must explain how the adjustment was calculated:

1. **Use HMRC's CGT Adjustment Calculator**: https://www.gov.uk/guidance/work-out-your-capital-gains-tax-adjustment-for-the-2024-to-2025-tax-year
   - If using this tool, attach the printout as evidence

2. **Manual calculation**: Provide a breakdown showing:
   - Disposals before 30 October 2024 (with dates and gains)
   - Disposals after 30 October 2024 (with dates and gains)
   - Allocation of AEA and losses
   - Tax calculation for each period
   - Final adjustment amount

3. **Attach to return**: Include your calculation in the "Any other information" box or as a separate attachment

## Anti-Forestalling Rules

HMRC introduced anti-forestalling rules to prevent tax avoidance by manipulating disposal dates.

### What are they?

These rules target:
- Unconditional contracts entered into **before** 30 October 2024
- That did not complete until **30 October 2024 or later**
- Where parties were **connected persons**
- And the transaction was not entered into for **wholly commercial reasons**

### When do they apply?

If gain exceeds £100,000 and the above conditions apply, the **new higher rates (18%/24%)** apply even though the contract was agreed before 30 October.

### What to do?

If your gain exceeds £100,000 and involves an unconditional contract that completed after 30 October 2024, you must either:
- Apply the anti-forestalling rules (if conditions met), OR
- Include a statement in "Any other information" box confirming the rules do **not** apply

## References

### Official HMRC Guidance
- [Work out your Capital Gains Tax adjustment (2024-25)](https://www.gov.uk/guidance/work-out-your-capital-gains-tax-adjustment-for-the-2024-to-2025-tax-year)
- [Capital Gains Tax rates and allowances (2024-25)](https://www.gov.uk/government/publications/rates-and-allowances-capital-gains-tax/capital-gains-tax-rates-and-annual-tax-free-allowances)
- [Self Assessment tax return notes (SA150)](https://www.gov.uk/government/publications/self-assessment-tax-return-sa100)

### Legal References
- Finance Act 2024, Schedule 2 (CGT rate changes)
- TCGA 1992 (Taxation of Chargeable Gains Act 1992)

## Tax Year 2024-25 Key Dates

| Date | Event |
|------|-------|
| 6 April 2024 | Tax year begins |
| **30 October 2024** | **CGT rates increase** |
| 5 April 2025 | Tax year ends |
| 31 October 2025 | Paper return deadline |
| 31 January 2026 | Online return deadline |
| 31 January 2026 | Payment deadline for any tax owed |

## Annual Exempt Amount (Historical)

| Tax Year | Annual Exempt Amount |
|----------|---------------------|
| 2020/21 | £12,300 |
| 2021/22 | £12,300 |
| 2022/23 | £12,300 |
| 2023/24 | £6,000 |
| **2024/25** | **£3,000** |

## Dividend Allowance (Historical)

| Tax Year | Dividend Allowance |
|----------|-------------------|
| 2020/21 | £2,000 |
| 2021/22 | £2,000 |
| 2022/23 | £2,000 |
| 2023/24 | £1,000 |
| **2024/25** | **£500** |
