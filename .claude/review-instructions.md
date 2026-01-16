# Code Review Instructions

## HMRC Compliance Review Requirements

When reviewing code changes in this Capital Gains Tax Visualiser project, apply the following domain-specific review criteria in addition to standard code quality checks.

### 1. Validate Calculation Logic Against HMRC Guidelines

For any changes involving tax calculations, CGT matching rules, or financial computations:

- **Research and verify** that calculation logic aligns with official HMRC guidance
- Cross-reference with relevant HMRC manuals and legislation:
  - **TCGA92/S105(1)** - Same-day matching rule
  - **TCGA92/S106A(5)** - 30-day "bed and breakfast" rule
  - **TCGA92/S104** - Section 104 pooled holdings
  - **TCGA92/S127** - Share reorganisations and stock splits
  - HMRC Capital Gains Manual (CG series): CG51560, CG51620, CG51127
- Flag any calculations that deviate from or don't clearly implement HMRC rules
- Verify correct handling of UK tax year boundaries (April 6 - April 5)
- Ensure allowable costs and reliefs are calculated per HMRC guidance

### 2. HMRC Reference Documentation Requirements

**For any new tax rules, calculations, or CGT logic added:**

- **REQUIRE** that UI components include tooltips or help sections with HMRC references
- Check for appropriate use of the existing tooltip/help patterns in the codebase
- Ensure references link to or cite:
  - Official HMRC manual section numbers (e.g., CG51560)
  - Relevant legislation references (e.g., TCGA92/S105)
  - Where applicable, links to gov.uk guidance pages

**Example of expected documentation:**
```tsx
// When displaying same-day rule matches:
<Tooltip content="Same-day rule per HMRC CG51560 (TCGA92/S105(1)): Shares bought and sold on the same day are matched first." />
```

### 3. Review Checklist for Tax-Related Changes

When reviewing PRs that touch files in:
- `src/lib/cgt/` - CGT matching engine
- `src/lib/enrichment.ts` - Transaction enrichment
- `src/utils/taxYear.ts` - Tax year calculations
- Any component displaying tax calculations

Verify:
- [ ] Calculation logic matches HMRC guidance (cite specific manual reference)
- [ ] Edge cases handled per HMRC rules (e.g., tax year boundaries, partial matches)
- [ ] User-facing explanations include HMRC references
- [ ] Tooltips/help text added for new rules or calculations
- [ ] `docs/SPECIFICATION.md` updated if new rules implemented

### 4. Existing HMRC References in Codebase

The project already references these HMRC guidelines (see `CLAUDE.md` and `docs/SPECIFICATION.md`):

| Rule | HMRC Reference | Legislation |
|------|----------------|-------------|
| Same-day matching | CG51560 | TCGA92/S105(1) |
| 30-day bed & breakfast | CG51560 | TCGA92/S106A(5) |
| Section 104 pooling | CG51620 | TCGA92/S104 |
| Share reorganisations | CG51127 | TCGA92/S127 |

New rules should follow the same documentation pattern.

### 5. Additional Review Considerations

- **Privacy**: Ensure no external data transmission is added
- **Audit trail**: Original transaction data must remain unmodified; computed values stored separately
- **Transparency**: Users should be able to see both original and calculated values
- **UK-specific context**: All tax logic applies to UK CGT rules only

## Standard Code Quality Checks

In addition to HMRC-specific requirements, apply standard review criteria:
- TypeScript strict mode compliance
- No unused variables or imports
- Test coverage for new logic
- Clear separation between raw data (`GenericTransaction`) and computed fields (`EnrichedTransaction`)
