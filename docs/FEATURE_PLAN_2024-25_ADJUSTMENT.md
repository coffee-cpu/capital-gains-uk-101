# Feature Plan: 2024-25 CGT Rate Change Adjustment Support

## Problem Statement

The 2024-25 tax year introduced a mid-year CGT rate change (30 October 2024), increasing rates from 10%/20% to 18%/24% for "other gains" (shares/securities). HMRC's automatic Self Assessment calculations do not account for this split, requiring taxpayers to manually calculate and report adjustments.

**Our tool currently:**
- ✅ Correctly calculates gains/losses per disposal
- ✅ Applies HMRC matching rules (same-day, 30-day, Section 104)
- ✅ Generates disposal records with dates
- ✅ Calculates total gains and losses for the tax year
- ❌ Does NOT split gains by the 30 October 2024 threshold
- ❌ Does NOT calculate the CGT rate adjustment
- ❌ Does NOT provide guidance on whether adjustment is needed

## User Impact

Users filing 2024-25 tax returns need to:
1. Identify whether they need to make an adjustment
2. Calculate the adjustment amount (if required)
3. Report it correctly on their Self Assessment return

**Without tool support**, users must:
- Manually review disposal dates from the PDF
- Manually split gains into pre/post 30 October buckets
- Manually calculate tax at different rates
- Use HMRC's external calculator or spreadsheet
- Risk making errors in allocation or calculation

## Proposed Features

### Phase 1: Detection & Alert (MVP)

**Goal**: Inform users whether they need to calculate an adjustment

#### 1.1 Tax Year-Specific Logic
```typescript
// src/lib/cgt/rateChange2024.ts

interface RateChangeConfig {
  taxYear: string
  thresholdDate: string  // '2024-10-30'
  oldRates: { basic: number; higher: number }  // 0.10, 0.20
  newRates: { basic: number; higher: number }  // 0.18, 0.24
}

function getRateChangeConfig(taxYear: string): RateChangeConfig | null {
  if (taxYear === '2024/25') {
    return {
      taxYear: '2024/25',
      thresholdDate: '2024-10-30',
      oldRates: { basic: 0.10, higher: 0.20 },
      newRates: { basic: 0.18, higher: 0.24 }
    }
  }
  return null  // No mid-year rate change for other years
}
```

#### 1.2 Adjustment Detection Function
```typescript
interface AdjustmentDetectionResult {
  adjustmentRequired: boolean
  reason: string
  disposalsBeforeThreshold: DisposalRecord[]
  disposalsAfterThreshold: DisposalRecord[]
  gainsBeforeThreshold: number
  gainsAfterThreshold: number
  netGain: number
  annualExemptAmount: number
}

function detectAdjustmentRequired(
  taxYear: string,
  disposals: DisposalRecord[],
  taxYearSummary: TaxYearSummary
): AdjustmentDetectionResult {
  const config = getRateChangeConfig(taxYear)

  if (!config) {
    return {
      adjustmentRequired: false,
      reason: 'No mid-year rate change for this tax year'
      // ...
    }
  }

  // Split disposals by threshold date
  const before = disposals.filter(d => d.disposal.date < config.thresholdDate)
  const after = disposals.filter(d => d.disposal.date >= config.thresholdDate)

  // Calculate gains in each period
  const gainsBefore = before.reduce((sum, d) => sum + Math.max(0, d.gainOrLossGbp), 0)
  const gainsAfter = after.reduce((sum, d) => sum + Math.max(0, d.gainOrLossGbp), 0)

  // Check if adjustment needed
  if (before.length === 0 || after.length === 0) {
    return {
      adjustmentRequired: false,
      reason: 'All disposals in same rate period'
      // ...
    }
  }

  if (taxYearSummary.netGainOrLossGbp <= taxYearSummary.annualExemptAmount) {
    return {
      adjustmentRequired: false,
      reason: 'Net gain below Annual Exempt Amount - no tax due'
      // ...
    }
  }

  return {
    adjustmentRequired: true,
    reason: 'Disposals in both rate periods with taxable gain',
    disposalsBeforeThreshold: before,
    disposalsAfterThreshold: after,
    gainsBeforeThreshold: gainsBefore,
    gainsAfterThreshold: gainsAfter,
    netGain: taxYearSummary.netGainOrLossGbp,
    annualExemptAmount: taxYearSummary.annualExemptAmount
  }
}
```

#### 1.3 UI Alert Component
Display alert in `TaxYearSummary` component when adjustment may be required:

```tsx
// src/components/RateChangeAlert.tsx

interface RateChangeAlertProps {
  taxYear: string
  adjustmentDetection: AdjustmentDetectionResult
}

export function RateChangeAlert({ taxYear, adjustmentDetection }: RateChangeAlertProps) {
  if (!adjustmentDetection.adjustmentRequired) {
    return null
  }

  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-amber-400" /* ... warning icon ... */ />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-amber-800">
            CGT Rate Change Adjustment May Be Required
          </h3>
          <div className="mt-2 text-sm text-amber-700">
            <p>
              The 2024-25 tax year had a mid-year rate change on 30 October 2024.
              You have disposals both before and after this date with a taxable gain.
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Disposals before 30 Oct 2024: {adjustmentDetection.disposalsBeforeThreshold.length}
                  (gains: £{adjustmentDetection.gainsBeforeThreshold.toFixed(2)})</li>
              <li>Disposals after 30 Oct 2024: {adjustmentDetection.disposalsAfterThreshold.length}
                  (gains: £{adjustmentDetection.gainsAfterThreshold.toFixed(2)})</li>
            </ul>
            <div className="mt-3">
              <a
                href="/docs/cgt-rate-change-2024-25"
                className="text-amber-800 underline hover:text-amber-900"
              >
                Learn more about the rate change and adjustment calculation →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### Phase 2: Adjustment Calculator

**Goal**: Calculate the exact adjustment amount for users

#### 2.1 Tax Rate Calculation Function
```typescript
interface TaxBracket {
  name: 'basic' | 'higher'
  rate: number
}

interface AdjustmentCalculation {
  // Input assumptions
  taxBracket: TaxBracket  // User input: basic or higher rate taxpayer

  // Allocation of deductions
  aeaAllocatedBefore: number
  aeaAllocatedAfter: number
  lossesAllocatedBefore: number
  lossesAllocatedAfter: number

  // Taxable amounts
  taxableGainBefore: number  // After AEA/losses
  taxableGainAfter: number   // After AEA/losses

  // Tax calculations
  taxBeforeAtOldRate: number  // 10% or 20%
  taxAfterAtNewRate: number   // 18% or 24%
  totalCorrectTax: number

  // HMRC's automatic calculation (estimated)
  hmrcAssumedRate: number
  hmrcCalculatedTax: number

  // Adjustment required
  adjustmentAmount: number  // Positive = increase tax, Negative = decrease tax
}

function calculateAdjustment(
  taxYear: string,
  disposals: DisposalRecord[],
  taxYearSummary: TaxYearSummary,
  taxBracket: 'basic' | 'higher'
): AdjustmentCalculation {
  const config = getRateChangeConfig(taxYear)!

  // Split gains by period
  const before = disposals.filter(d => d.disposal.date < config.thresholdDate)
  const after = disposals.filter(d => d.disposal.date >= config.thresholdDate)

  const gainsBefore = before.reduce((sum, d) => sum + Math.max(0, d.gainOrLossGbp), 0)
  const gainsAfter = after.reduce((sum, d) => sum + Math.max(0, d.gainOrLossGbp), 0)
  const totalLosses = Math.abs(taxYearSummary.totalLossesGbp)

  // OPTIMAL ALLOCATION: Deduct AEA and losses from HIGHEST-rate gains first
  // After 30 Oct has higher rates (18%/24%) than before (10%/20%)

  let aeaAllocatedAfter = 0
  let aeaAllocatedBefore = 0
  let lossesAllocatedAfter = 0
  let lossesAllocatedBefore = 0

  let remainingAEA = taxYearSummary.annualExemptAmount
  let remainingLosses = totalLosses

  // Allocate to higher-rate period first (after 30 Oct)
  aeaAllocatedAfter = Math.min(gainsAfter, remainingAEA)
  remainingAEA -= aeaAllocatedAfter

  lossesAllocatedAfter = Math.min(gainsAfter - aeaAllocatedAfter, remainingLosses)
  remainingLosses -= lossesAllocatedAfter

  // Allocate remainder to lower-rate period (before 30 Oct)
  aeaAllocatedBefore = Math.min(gainsBefore, remainingAEA)
  lossesAllocatedBefore = Math.min(gainsBefore - aeaAllocatedBefore, remainingLosses)

  // Calculate taxable amounts
  const taxableGainAfter = Math.max(0, gainsAfter - aeaAllocatedAfter - lossesAllocatedAfter)
  const taxableGainBefore = Math.max(0, gainsBefore - aeaAllocatedBefore - lossesAllocatedBefore)

  // Calculate tax at correct rates
  const oldRate = taxBracket === 'basic' ? config.oldRates.basic : config.oldRates.higher
  const newRate = taxBracket === 'basic' ? config.newRates.basic : config.newRates.higher

  const taxBeforeAtOldRate = taxableGainBefore * oldRate
  const taxAfterAtNewRate = taxableGainAfter * newRate
  const totalCorrectTax = taxBeforeAtOldRate + taxAfterAtNewRate

  // Estimate HMRC's calculation (blended rate - simplified)
  // HMRC likely uses 20% or 24% depending on how they implement it
  // For safety, assume they use the NEW rate for everything
  const hmrcAssumedRate = newRate
  const hmrcCalculatedTax = taxYearSummary.taxableGainGbp * hmrcAssumedRate

  // Adjustment
  const adjustmentAmount = totalCorrectTax - hmrcCalculatedTax

  return {
    taxBracket: { name: taxBracket, rate: taxBracket === 'basic' ? newRate : newRate },
    aeaAllocatedBefore,
    aeaAllocatedAfter,
    lossesAllocatedBefore,
    lossesAllocatedAfter,
    taxableGainBefore,
    taxableGainAfter,
    taxBeforeAtOldRate,
    taxAfterAtNewRate,
    totalCorrectTax,
    hmrcAssumedRate,
    hmrcCalculatedTax,
    adjustmentAmount
  }
}
```

#### 2.2 UI Component for Adjustment Calculator
```tsx
// src/components/AdjustmentCalculator.tsx

export function AdjustmentCalculator({ taxYear, disposals, taxYearSummary }: Props) {
  const [taxBracket, setTaxBracket] = useState<'basic' | 'higher'>('higher')
  const [showCalculation, setShowCalculation] = useState(false)

  const calculation = calculateAdjustment(taxYear, disposals, taxYearSummary, taxBracket)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">
        CGT Rate Change Adjustment Calculator
      </h3>

      {/* Tax bracket selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Are you a basic rate or higher rate taxpayer?
        </label>
        <select
          value={taxBracket}
          onChange={(e) => setTaxBracket(e.target.value as 'basic' | 'higher')}
          className="form-select"
        >
          <option value="basic">Basic rate (18% on gains after 30 Oct 2024)</option>
          <option value="higher">Higher rate (24% on gains after 30 Oct 2024)</option>
        </select>
      </div>

      {/* Summary result */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
        <div className="flex justify-between items-center">
          <span className="font-medium">Adjustment to report on Self Assessment:</span>
          <span className={`text-xl font-bold ${
            calculation.adjustmentAmount >= 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {calculation.adjustmentAmount >= 0 ? '+' : ''}£{Math.abs(calculation.adjustmentAmount).toFixed(2)}
          </span>
        </div>
        {calculation.adjustmentAmount > 0 && (
          <p className="text-xs text-blue-700 mt-2">
            Enter this positive amount in the "Adjustment to Capital Gains Tax" box
          </p>
        )}
        {calculation.adjustmentAmount < 0 && (
          <p className="text-xs text-blue-700 mt-2">
            Enter this as a negative amount (with minus sign) in the "Adjustment to Capital Gains Tax" box
          </p>
        )}
      </div>

      {/* Show detailed calculation breakdown */}
      <button
        onClick={() => setShowCalculation(!showCalculation)}
        className="text-sm text-blue-600 hover:text-blue-800"
      >
        {showCalculation ? 'Hide' : 'Show'} detailed calculation
      </button>

      {showCalculation && (
        <div className="mt-4 space-y-4 text-sm">
          {/* Breakdown of allocation, tax calculation, etc. */}
          {/* ... detailed calculation steps ... */}
        </div>
      )}
    </div>
  )
}
```

### Phase 3: PDF Export Enhancement

**Goal**: Include adjustment calculation in PDF report for evidence

#### 3.1 Add Adjustment Section to PDF
```typescript
// In PDFExport.tsx

{taxYear === '2024/25' && adjustmentDetection.adjustmentRequired && (
  <>
    <Text style={styles.subtitle}>CGT Rate Change Adjustment (30 October 2024)</Text>
    <View style={styles.summaryBox}>
      <Text style={{ fontSize: 8, marginBottom: 4 }}>
        The 2024-25 tax year had a mid-year rate change on 30 October 2024.
        CGT rates increased from 10%/20% to 18%/24% for share disposals.
      </Text>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Disposals before 30 Oct 2024:</Text>
        <Text style={styles.summaryValue}>{adjustmentDetection.disposalsBeforeThreshold.length}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Gains before 30 Oct 2024:</Text>
        <Text style={styles.summaryValue}>
          £{adjustmentDetection.gainsBeforeThreshold.toFixed(2)}
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Disposals after 30 Oct 2024:</Text>
        <Text style={styles.summaryValue}>{adjustmentDetection.disposalsAfterThreshold.length}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Gains after 30 Oct 2024:</Text>
        <Text style={styles.summaryValue}>
          £{adjustmentDetection.gainsAfterThreshold.toFixed(2)}
        </Text>
      </View>

      {adjustmentCalculation && (
        <>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Adjustment required:</Text>
            <Text style={[styles.totalValue, {
              color: adjustmentCalculation.adjustmentAmount >= 0 ? '#dc2626' : '#059669'
            }]}>
              {adjustmentCalculation.adjustmentAmount >= 0 ? '+' : ''}
              £{Math.abs(adjustmentCalculation.adjustmentAmount).toFixed(2)}
            </Text>
          </View>
        </>
      )}
    </View>
  </>
)}
```

### Phase 4: Documentation Page

**Goal**: In-app guidance accessible from hash route

#### 4.1 Create Documentation Route
```tsx
// src/App.tsx - add new route

const [currentPage, setCurrentPage] = useState<'calculator' | 'about' | 'rate-change-2024-25'>('calculator')

// Handle #rate-change-2024-25 route
useEffect(() => {
  const handleHashChange = () => {
    const hash = window.location.hash.slice(1)
    if (hash === 'rate-change-2024-25') setCurrentPage('rate-change-2024-25')
    else if (hash === 'about') setCurrentPage('about')
    else setCurrentPage('calculator')
  }
  // ...
}, [])
```

#### 4.2 Render Markdown Documentation
```tsx
// src/components/RateChangeGuidance.tsx

import ReactMarkdown from 'react-markdown'
import rateChangeDoc from '../docs/CGT_RATE_CHANGE_2024-25.md?raw'

export function RateChangeGuidance() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 prose prose-blue">
      <ReactMarkdown>{rateChangeDoc}</ReactMarkdown>
    </div>
  )
}
```

## Implementation Priority

### Must-Have (Phase 1)
- ✅ Detection logic for 2024-25 tax year
- ✅ Alert component when adjustment may be needed
- ✅ Link to external HMRC guidance
- ✅ Documentation file (this already created)

### Should-Have (Phase 2)
- Calculator for adjustment amount
- Tax bracket selector (basic/higher rate)
- Detailed breakdown showing allocation logic

### Nice-to-Have (Phase 3)
- PDF export with adjustment section
- Printable calculation evidence
- Copy-paste formatted text for SA return

### Future (Phase 4)
- In-app documentation page
- Interactive examples
- Historical rate change support (if future years have similar changes)

## Data Model Changes

### Extend `TaxYearSummary`
```typescript
interface TaxYearSummary {
  // ... existing fields ...

  /** Rate change adjustment (2024-25 specific) */
  rateChangeAdjustment?: {
    thresholdDate: string
    disposalsBeforeThreshold: number
    disposalsAfterThreshold: number
    gainsBeforeThreshold: number
    gainsAfterThreshold: number
    adjustmentRequired: boolean
    calculatedAdjustment?: number  // If user ran calculator
    taxBracketUsed?: 'basic' | 'higher'
  }
}
```

## Testing Requirements

### Unit Tests
- `detectAdjustmentRequired()` - various scenarios
- `calculateAdjustment()` - verify allocation logic
- Rate config lookup for different tax years

### E2E Tests
- Import CSV with 2024-25 disposals spanning 30 Oct
- Verify alert appears
- Calculator produces correct adjustment
- PDF includes adjustment section

### Test Scenarios
1. All disposals before 30 Oct → No adjustment
2. All disposals after 30 Oct → No adjustment
3. Split disposals, net gain < £3,000 → No adjustment
4. Split disposals, net gain > £3,000 → Adjustment required
5. Edge case: disposal exactly on 30 Oct 2024

## UX Considerations

### Progressive Disclosure
- Don't overwhelm users with tax jargon upfront
- Show simple alert first: "You may need to report an adjustment"
- Expand to calculator only if user clicks "Calculate adjustment"

### Language & Tone
- Use plain English, avoid tax code references in UI
- Provide examples and concrete numbers
- Link to official HMRC guidance for legal authority

### Accessibility
- Alert should be keyboard-navigable
- Calculator form should have proper labels
- Color indicators should not be sole differentiator (use text too)

## Open Questions

1. **Tax bracket detection**: Can we infer from income data, or must user always select?
2. **HMRC's actual blended rate**: What rate does HMRC's system actually use? (May need testing with real returns)
3. **Basic rate band**: Should we ask user for unused basic rate band to handle edge cases?
4. **Anti-forestalling rules**: Do we need to check for £100k+ gains with delayed completions?
5. **Future-proofing**: What if 2025-26 has another mid-year change? Make this generic?

## Success Metrics

- % of 2024-25 tax year users who see the alert
- % who use the adjustment calculator
- User feedback on clarity and helpfulness
- Reduction in support questions about rate changes

## Dependencies

- None - all features can be built with existing tech stack
- Optional: `react-markdown` for rendering .md files in-app (Phase 4)

## Timeline Estimate

- **Phase 1 (MVP Alert)**: 2-3 days
- **Phase 2 (Calculator)**: 3-5 days
- **Phase 3 (PDF Export)**: 1-2 days
- **Phase 4 (Docs Page)**: 1 day

**Total: ~1-2 weeks** for full implementation
