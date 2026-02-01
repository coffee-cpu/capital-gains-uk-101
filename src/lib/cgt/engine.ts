import { EnrichedTransaction } from '../../types/transaction'
import { CGTCalculationResult, DisposalRecord, TaxYearSummary, MatchingResult } from '../../types/cgt'
import { MatchingStage, runMatchingPipeline } from './pipeline'
import { shortSellStage } from './shortSellMatcher'
import { sameDayStage } from './sameDayMatcher'
import { thirtyDayStage } from './thirtyDayMatcher'
import { section104Stage } from './section104Pool'
import { getTaxYearBounds } from '../../utils/taxYear'
import { getEffectiveQuantity, getEffectivePrice, isAcquisition, isDisposal } from './utils'
import { calculateTaxYearFeatures } from './taxYearFeatures'

/**
 * CGT Calculation Engine
 *
 * Uses the Pipeline pattern to apply HMRC matching rules in the correct order:
 * 0. Short sell rule - Match uncovered SELLs with subsequent BUYs
 * 1. Same-day rule (TCGA92/S105(1)) - CG51560
 * 2. 30-day rule (TCGA92/S106A(5) and (5A)) - CG51560
 * 3. Section 104 pooling (TCGA92/S104) - CG51620
 *
 * Each stage is a self-contained unit that transforms the pipeline context,
 * making the rule application composable, testable, and extensible.
 */

/**
 * Default pipeline stages in HMRC-mandated order
 *
 * Each stage is responsible for its own matching logic and is imported
 * from its respective module, following the Single Responsibility Principle.
 */
const DEFAULT_MATCHING_STAGES: MatchingStage[] = [
  shortSellStage,
  sameDayStage,
  thirtyDayStage,
  section104Stage,
]

/**
 * Calculate capital gains tax for all transactions
 *
 * @param transactions Array of enriched transactions (with FX rates and GBP values)
 * @returns Complete CGT calculation result
 */
export function calculateCGT(
  transactions: EnrichedTransaction[]
): CGTCalculationResult {
  // Filter out ignored transactions (incomplete Stock Plan Activity superseded by Equity Awards)
  const activeTransactions = transactions.filter(tx => !tx.ignored)

  // Run the matching pipeline (applies all HMRC rules in order)
  const pipelineResult = runMatchingPipeline(activeTransactions, DEFAULT_MATCHING_STAGES)

  // Assign match group IDs to link related transactions
  const updatedTransactions = assignMatchGroupIds(
    pipelineResult.transactions,
    pipelineResult.matchings
  )

  // Create disposal records
  const disposals = createDisposalRecords(pipelineResult.matchings)

  // Generate tax year summaries (pass all transactions for dividend calculations)
  const taxYearSummaries = generateTaxYearSummaries(disposals, updatedTransactions)

  // Compile metadata
  const metadata = {
    calculatedAt: new Date().toISOString(),
    totalTransactions: activeTransactions.length,
    totalBuys: activeTransactions.filter(tx => isAcquisition(tx)).length,
    totalSells: activeTransactions.filter(tx => isDisposal(tx)).length,
  }

  // Return all transactions (including ignored ones) so they can be displayed in UI
  // But merge back the ignored ones without any gain_group modifications
  const allTransactionsWithGroups = transactions.map(tx => {
    if (tx.ignored) return tx
    const updated = updatedTransactions.find(u => u.id === tx.id)
    return updated || tx
  })

  return {
    transactions: allTransactionsWithGroups,
    disposals,
    section104Pools: pipelineResult.section104Pools,
    taxYearSummaries,
    metadata,
  }
}

/**
 * Create disposal records from matching results
 *
 * Groups matchings by disposal transaction and calculates gain/loss
 */
function createDisposalRecords(matchings: MatchingResult[]): DisposalRecord[] {
  // Group matchings by disposal transaction ID
  const disposalMap = new Map<string, MatchingResult[]>()

  for (const matching of matchings) {
    const disposalId = matching.disposal.id
    if (!disposalMap.has(disposalId)) {
      disposalMap.set(disposalId, [])
    }
    disposalMap.get(disposalId)!.push(matching)
  }

  // Create disposal record for each unique disposal
  const records: DisposalRecord[] = []

  for (const [disposalId, disposalMatchings] of disposalMap) {
    const disposal = disposalMatchings[0].disposal

    // Calculate total disposal quantity
    const disposalQuantity = getEffectiveQuantity(disposal)

    // Calculate total matched quantity across all matchings
    const totalMatchedQuantity = disposalMatchings.reduce(
      (sum, matching) => sum + matching.quantityMatched,
      0
    )

    // Calculate unmatched quantity (if any)
    const unmatchedQuantity = disposalQuantity - totalMatchedQuantity
    const isIncomplete = unmatchedQuantity > 0

    // Calculate proceeds - ONLY for matched portion to ensure accurate CGT calculation
    //
    // For options transactions, the price is quoted per-share but quantity is in contracts.
    // Each contract typically represents 100 shares (contract_size), so we need to multiply
    // quantity by contract_size to get the correct proceeds calculation.
    const pricePerShare = getEffectivePrice(disposal)
    const contractMultiplier = disposal.contract_size || 1
    const feePerShare = disposal.fee_gbp ? disposal.fee_gbp / (disposalQuantity * contractMultiplier) : 0

    // For incomplete disposals, only calculate proceeds for matched shares
    // Multiply by contract_size for options (e.g., 4 contracts * 100 shares * $1.10/share)
    const matchedProceeds = (pricePerShare - feePerShare) * totalMatchedQuantity * contractMultiplier

    // For complete records, use all proceeds
    const netProceeds = matchedProceeds

    // Sum up all allowable costs from matched acquisitions
    const totalCostBasis = disposalMatchings.reduce(
      (sum, matching) => sum + matching.totalCostBasisGbp,
      0
    )

    // Calculate gain or loss (only for matched portion)
    const gainOrLoss = netProceeds - totalCostBasis

    records.push({
      id: `disposal-${disposalId}`,
      disposal,
      matchings: disposalMatchings,
      proceedsGbp: netProceeds,
      allowableCostsGbp: totalCostBasis,
      gainOrLossGbp: gainOrLoss,
      taxYear: disposal.tax_year,
      unmatchedQuantity: isIncomplete ? unmatchedQuantity : undefined,
      isIncomplete,
    })
  }

  // Sort by date
  return records.sort((a, b) => a.disposal.date.localeCompare(b.disposal.date))
}

/**
 * Generate tax year summaries from disposal records and all transactions
 */
function generateTaxYearSummaries(
  disposals: DisposalRecord[],
  transactions: EnrichedTransaction[]
): TaxYearSummary[] {
  // Group disposals by tax year
  const byTaxYear = new Map<string, DisposalRecord[]>()

  for (const disposal of disposals) {
    const taxYear = disposal.taxYear
    if (!byTaxYear.has(taxYear)) {
      byTaxYear.set(taxYear, [])
    }
    byTaxYear.get(taxYear)!.push(disposal)
  }

  // Get all unique tax years from both disposals and transactions
  const allTaxYears = new Set<string>()
  disposals.forEach(d => allTaxYears.add(d.taxYear))
  transactions.forEach(tx => allTaxYears.add(tx.tax_year))

  // Create summary for each tax year
  const summaries: TaxYearSummary[] = []

  for (const taxYear of allTaxYears) {
    const { startDate, endDate } = getTaxYearBounds(taxYear)
    const yearDisposals = byTaxYear.get(taxYear) || []

    // Calculate CGT totals
    const totalDisposals = yearDisposals.length
    const totalProceeds = yearDisposals.reduce((sum, d) => sum + d.proceedsGbp, 0)
    const totalAllowableCosts = yearDisposals.reduce((sum, d) => sum + d.allowableCostsGbp, 0)

    // Separate gains and losses
    const gains = yearDisposals.filter(d => d.gainOrLossGbp > 0)
    const losses = yearDisposals.filter(d => d.gainOrLossGbp < 0)

    const totalGains = gains.reduce((sum, d) => sum + d.gainOrLossGbp, 0)
    const totalLosses = losses.reduce((sum, d) => sum + d.gainOrLossGbp, 0)

    const netGainOrLoss = totalGains + totalLosses

    // Get annual exempt amount for this tax year
    const annualExemptAmount = getAnnualExemptAmount(taxYear)

    // Calculate taxable gain (cannot be negative)
    const taxableGain = Math.max(0, netGainOrLoss - annualExemptAmount)

    // Calculate dividend totals for this tax year
    const yearDividends = transactions.filter(
      tx => tx.tax_year === taxYear && tx.type === 'DIVIDEND'
    )
    const totalDividends = yearDividends.length

    // Gross dividends: use grossDividend_gbp when available (IB/Freetrade),
    // otherwise value_gbp (Schwab dividends where total IS gross)
    const grossDividendsGbp = yearDividends.reduce(
      (sum, tx) => sum + (tx.grossDividend_gbp ?? tx.value_gbp ?? 0),
      0
    )

    // Withholding tax from two sources:
    // 1. withholdingTax_gbp on DIVIDEND (IB/Freetrade set this directly)
    // 2. TAX_ON_DIVIDEND transactions (Schwab NRA Tax Adj emitted as separate rows)
    const dividendWithholdingFromIncome = yearDividends.reduce(
      (sum, tx) => sum + (tx.withholdingTax_gbp ?? 0),
      0
    )
    const yearTaxOnDividend = transactions.filter(
      tx => tx.tax_year === taxYear && tx.type === 'TAX_ON_DIVIDEND'
    )
    const dividendWithholdingFromTax = yearTaxOnDividend.reduce(
      (sum, tx) => sum + (tx.value_gbp ?? 0),
      0
    )
    const totalWithholdingTaxGbp = dividendWithholdingFromIncome + dividendWithholdingFromTax

    // Net dividends = gross - all withholding
    const totalDividendsGbp = grossDividendsGbp - totalWithholdingTaxGbp

    // Get dividend allowance for this tax year
    const dividendAllowance = getDividendAllowance(taxYear)

    // Calculate interest totals for this tax year
    const yearInterest = transactions.filter(
      tx => tx.tax_year === taxYear && tx.type === 'INTEREST'
    )
    const totalInterest = yearInterest.length

    // Same pattern for interest withholding
    const interestWithholdingFromIncome = yearInterest.reduce(
      (sum, tx) => sum + (tx.withholdingTax_gbp ?? 0),
      0
    )
    const yearTaxOnInterest = transactions.filter(
      tx => tx.tax_year === taxYear && tx.type === 'TAX_ON_INTEREST'
    )
    const interestWithholdingFromTax = yearTaxOnInterest.reduce(
      (sum, tx) => sum + (tx.value_gbp ?? 0),
      0
    )
    const interestWithholdingTaxGbp = interestWithholdingFromIncome + interestWithholdingFromTax

    // Gross interest: value_gbp + any withholding already subtracted by parser (IB/Freetrade)
    const grossInterestGbp = yearInterest.reduce(
      (sum, tx) => sum + (tx.value_gbp || 0),
      0
    ) + interestWithholdingFromIncome

    // Net interest = gross - all withholding
    const totalInterestGbp = grossInterestGbp - interestWithholdingTaxGbp

    // Count incomplete disposals (those with missing acquisition data)
    const incompleteDisposals = yearDisposals.filter(d => d.isIncomplete).length

    // Create the summary (without features first)
    const summary: TaxYearSummary = {
      taxYear,
      startDate,
      endDate,
      disposals: yearDisposals,
      totalDisposals,
      totalProceedsGbp: totalProceeds,
      totalAllowableCostsGbp: totalAllowableCosts,
      totalGainsGbp: totalGains,
      totalLossesGbp: totalLosses,
      netGainOrLossGbp: netGainOrLoss,
      annualExemptAmount,
      taxableGainGbp: taxableGain,
      totalDividends,
      totalDividendsGbp,
      grossDividendsGbp,
      totalWithholdingTaxGbp,
      dividendAllowance,
      totalInterest,
      totalInterestGbp,
      grossInterestGbp,
      interestWithholdingTaxGbp,
      incompleteDisposals,
    }

    // Calculate tax year-specific features
    const features = calculateTaxYearFeatures(summary, yearDisposals)
    if (Object.keys(features).length > 0) {
      summary.features = features
    }

    summaries.push(summary)
  }

  // Sort by tax year (most recent first)
  return summaries.sort((a, b) => b.taxYear.localeCompare(a.taxYear))
}

/**
 * Get the annual exempt amount for a tax year
 *
 * Source: HMRC Capital Gains Tax annual exempt amounts
 * https://www.gov.uk/government/publications/rates-and-allowances-capital-gains-tax/capital-gains-tax-rates-and-annual-tax-free-allowances
 */
function getAnnualExemptAmount(taxYear: string): number {
  // Tax year format: "YYYY/YY" e.g., "2023/24"
  const startYear = parseInt(taxYear.split('/')[0])

  // Historical annual exempt amounts (individuals)
  if (startYear >= 2024) return 3000      // 2024/25 onwards
  if (startYear === 2023) return 6000     // 2023/24
  if (startYear >= 2020) return 12300     // 2020/21 to 2022/23
  if (startYear === 2019) return 12000    // 2019/20
  if (startYear === 2018) return 11700    // 2018/19
  if (startYear === 2017) return 11300    // 2017/18
  if (startYear >= 2015) return 11100     // 2015/16 to 2016/17

  // Default for older years (approximate)
  return 11000
}

/**
 * Get the dividend allowance for a tax year
 *
 * Source: HMRC Tax on dividends
 * https://www.gov.uk/tax-on-dividends
 *
 * Note: Dividend tax is separate from capital gains tax.
 * Dividends above the allowance may be subject to dividend tax rates
 * (8.75% basic, 33.75% higher, 39.35% additional rate).
 */
function getDividendAllowance(taxYear: string): number {
  // Tax year format: "YYYY/YY" e.g., "2023/24"
  const startYear = parseInt(taxYear.split('/')[0])

  // Historical dividend allowances
  if (startYear >= 2024) return 500       // 2024/25 onwards
  if (startYear === 2023) return 1000     // 2023/24
  if (startYear >= 2018) return 2000      // 2018/19 to 2022/23
  if (startYear >= 2016) return 5000      // 2016/17 to 2017/18

  // Default for older years (pre-dividend allowance era)
  return 0
}

/**
 * Assign match group IDs to link related transactions
 *
 * Each disposal and its matched acquisitions get the same match_group ID
 * for easy visual grouping in the UI.
 *
 * Note: A single acquisition can be matched against multiple disposals
 * (e.g., 100 shares bought once, then sold 30 and 70 separately),
 * so match_groups is an array.
 */
function assignMatchGroupIds(
  transactions: EnrichedTransaction[],
  matchings: MatchingResult[]
): EnrichedTransaction[] {
  // Create a map of transaction ID to array of match group IDs
  const txToMatchGroups = new Map<string, Set<string>>()

  // Process each matching - group disposal with its acquisitions
  for (const matching of matchings) {
    // Use the disposal ID as the match group ID (unique per disposal)
    const matchGroupId = matching.disposal.id

    // Add match group to disposal
    if (!txToMatchGroups.has(matching.disposal.id)) {
      txToMatchGroups.set(matching.disposal.id, new Set())
    }
    txToMatchGroups.get(matching.disposal.id)!.add(matchGroupId)

    // Add same match group to all matched acquisitions
    for (const acq of matching.acquisitions) {
      if (!txToMatchGroups.has(acq.transaction.id)) {
        txToMatchGroups.set(acq.transaction.id, new Set())
      }
      txToMatchGroups.get(acq.transaction.id)!.add(matchGroupId)
    }
  }

  // Update all transactions with their match group IDs
  return transactions.map(tx => ({
    ...tx,
    match_groups: txToMatchGroups.has(tx.id)
      ? Array.from(txToMatchGroups.get(tx.id)!)
      : undefined,
  }))
}
