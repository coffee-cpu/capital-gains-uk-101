import { EnrichedTransaction } from '../../types/transaction'
import { CGTCalculationResult, DisposalRecord, TaxYearSummary, MatchingResult } from '../../types/cgt'
import { MatchingStage, runMatchingPipeline } from './pipeline'
import { shortSellStage } from './shortSellMatcher'
import { sameDayStage } from './sameDayMatcher'
import { thirtyDayStage } from './thirtyDayMatcher'
import { section104Stage } from './section104Pool'
import { getTaxYearBounds } from '../../utils/taxYear'
import { getEffectiveQuantity, groupBy, isAcquisition, isDisposal, calculateGrossProceeds, calculateDisposalFees, hasGbpPrice, QUANTITY_EPSILON } from './utils'
import { netSameDayGains, splitGainsAndLosses } from './sa108'
import { calculateTaxYearFeatures } from './taxYearFeatures/registry'
import { getAnnualExemptAmount, getDividendAllowance } from './allowances'
import { summarizeDividends, summarizeInterest } from './income'

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
  // But merge back the ignored ones without any match-group modifications
  const updatedById = new Map(updatedTransactions.map(tx => [tx.id, tx]))
  const allTransactionsWithGroups = transactions.map(tx => {
    if (tx.ignored) return tx
    return updatedById.get(tx.id) || tx
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
  const disposalMap = groupBy(matchings, matching => matching.disposal.id)

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
    const isIncomplete = unmatchedQuantity > QUANTITY_EPSILON

    // Proceeds and costs cover only the matched portion, so an unmatched
    // remainder doesn't show as pure gain.
    //
    // Proceeds are gross (before selling fees) and the selling fees are an
    // allowable cost, as SA108 reports them. Options prices are per share and
    // quantities in contracts; both helpers apply contract_size.
    const grossProceeds = calculateGrossProceeds(disposal, totalMatchedQuantity)
    const disposalFees = calculateDisposalFees(disposal, totalMatchedQuantity)

    // Acquisition costs from the matched acquisitions, plus the selling fees
    const totalCostBasis = disposalMatchings.reduce(
      (sum, matching) => sum + matching.totalCostBasisGbp,
      disposalFees
    )

    // Calculate gain or loss (only for matched portion)
    const gainOrLoss = grossProceeds - totalCostBasis

    // A missing exchange rate values that side at £0. Section 104 matches
    // carry the pool's flag; their synthetic acquisition is priced at the
    // pool average, so it can't be checked directly.
    const missingFx = !hasGbpPrice(disposal) || disposalMatchings.some(matching =>
      matching.missingFx ||
      (matching.rule !== 'SECTION_104' && matching.acquisitions.some(acq => !hasGbpPrice(acq.transaction)))
    )

    records.push({
      id: `disposal-${disposalId}`,
      disposal,
      matchings: disposalMatchings,
      proceedsGbp: grossProceeds,
      allowableCostsGbp: totalCostBasis,
      gainOrLossGbp: gainOrLoss,
      taxYear: disposal.tax_year,
      unmatchedQuantity: isIncomplete ? unmatchedQuantity : undefined,
      isIncomplete,
      ...(missingFx && { missingFx: true }),
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
  const disposalsByYear = groupBy(disposals, d => d.taxYear)
  const transactionsByYear = groupBy(transactions, tx => tx.tax_year)
  const allTaxYears = new Set([...disposalsByYear.keys(), ...transactionsByYear.keys()])

  const summaries = [...allTaxYears].map(taxYear => summarizeTaxYear(
    taxYear,
    disposalsByYear.get(taxYear) ?? [],
    transactionsByYear.get(taxYear) ?? []
  ))

  // Most recent first
  return summaries.sort((a, b) => b.taxYear.localeCompare(a.taxYear))
}

/**
 * Summarise one tax year: capital gains, then dividend and interest income
 */
function summarizeTaxYear(
  taxYear: string,
  yearDisposals: DisposalRecord[],
  yearTransactions: EnrichedTransaction[]
): TaxYearSummary {
  const { startDate, endDate } = getTaxYearBounds(taxYear)

  // Same-day disposals of one asset count as one disposal, with their gains
  // and losses netted (TCGA92/S105(1)(a)), so these match the SA108 figures
  // in the PDF and CLI.
  const sameDayNets = netSameDayGains(yearDisposals)
  const { gainsGbp: totalGains, lossesGbp } = splitGainsAndLosses(sameDayNets)
  const totalLosses = -lossesGbp || 0 // avoid -0 when there are no losses
  const netGainOrLoss = totalGains + totalLosses
  const annualExemptAmount = getAnnualExemptAmount(taxYear)

  const dividends = summarizeDividends(yearTransactions)
  const interest = summarizeInterest(yearTransactions)

  const summary: TaxYearSummary = {
    taxYear,
    startDate,
    endDate,
    disposals: yearDisposals,
    totalDisposals: sameDayNets.length,
    totalProceedsGbp: yearDisposals.reduce((sum, d) => sum + d.proceedsGbp, 0),
    totalAllowableCostsGbp: yearDisposals.reduce((sum, d) => sum + d.allowableCostsGbp, 0),
    totalGainsGbp: totalGains,
    totalLossesGbp: totalLosses,
    netGainOrLossGbp: netGainOrLoss,
    annualExemptAmount,
    // Taxable gain cannot be negative
    taxableGainGbp: Math.max(0, netGainOrLoss - annualExemptAmount),
    totalDividends: dividends.count,
    totalDividendsGbp: dividends.netGbp,
    grossDividendsGbp: dividends.grossGbp,
    totalWithholdingTaxGbp: dividends.withholdingGbp,
    dividendAllowance: getDividendAllowance(taxYear),
    totalInterest: interest.count,
    totalInterestGbp: interest.netGbp,
    grossInterestGbp: interest.grossGbp,
    interestWithholdingTaxGbp: interest.withholdingGbp,
    incompleteDisposals: yearDisposals.filter(d => d.isIncomplete).length,
    missingFxDisposals: yearDisposals.filter(d => d.missingFx).length,
  }

  const features = calculateTaxYearFeatures(summary, yearDisposals)
  if (Object.keys(features).length > 0) {
    summary.features = features
  }

  return summary
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
