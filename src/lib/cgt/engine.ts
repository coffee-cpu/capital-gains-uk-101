import { EnrichedTransaction } from '../../types/transaction'
import { CGTCalculationResult, DisposalRecord, TaxYearSummary, MatchingResult } from '../../types/cgt'
import { applySameDayRule, markSameDayMatches } from './sameDayMatcher'
import { applyThirtyDayRule, markThirtyDayMatches } from './thirtyDayMatcher'
import { applySection104Pooling, markSection104Matches } from './section104Pool'
import { getTaxYearBounds } from '../../utils/taxYear'

/**
 * CGT Calculation Engine
 *
 * Orchestrates the application of HMRC matching rules in the correct order:
 * 1. Same-day rule (TCGA92/S105(1)) - CG51560
 * 2. 30-day rule (TCGA92/S106A(5) and (5A)) - CG51560
 * 3. Section 104 pooling (TCGA92/S104) - CG51620
 *
 * Produces disposal records with full gain/loss calculations and tax year summaries.
 */

/**
 * Calculate capital gains tax for all transactions
 *
 * @param transactions Array of enriched transactions (with FX rates and GBP values)
 * @returns Complete CGT calculation result
 */
export function calculateCGT(
  transactions: EnrichedTransaction[]
): CGTCalculationResult {
  // Step 1: Apply same-day matching rule
  const sameDayMatchings = applySameDayRule(transactions)
  let updatedTransactions = markSameDayMatches(transactions, sameDayMatchings)

  // Step 2: Apply 30-day rule (to remaining unmatched quantities)
  const thirtyDayMatchings = applyThirtyDayRule(updatedTransactions, sameDayMatchings)
  updatedTransactions = markThirtyDayMatches(updatedTransactions, thirtyDayMatchings)

  // Step 3: Apply Section 104 pooling (to remaining unmatched quantities)
  const allMatchings = [...sameDayMatchings, ...thirtyDayMatchings]
  const [section104Matchings, section104Pools] = applySection104Pooling(
    updatedTransactions,
    allMatchings
  )
  updatedTransactions = markSection104Matches(updatedTransactions, section104Matchings)

  // Combine all matchings
  const allMatchingsComplete = [...sameDayMatchings, ...thirtyDayMatchings, ...section104Matchings]

  // Step 4: Create disposal records
  const disposals = createDisposalRecords(allMatchingsComplete)

  // Step 5: Generate tax year summaries
  const taxYearSummaries = generateTaxYearSummaries(disposals)

  // Step 6: Compile metadata
  const metadata = {
    calculatedAt: new Date().toISOString(),
    totalTransactions: transactions.length,
    totalBuys: transactions.filter(tx => tx.type === 'BUY').length,
    totalSells: transactions.filter(tx => tx.type === 'SELL').length,
  }

  return {
    transactions: updatedTransactions,
    disposals,
    section104Pools,
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

    // Calculate proceeds (sale price minus selling fees)
    const pricePerShare = disposal.price_gbp || 0
    const totalProceeds = pricePerShare * (disposal.quantity || 0)
    const sellingFees = disposal.fee_gbp || 0
    const netProceeds = totalProceeds - sellingFees

    // Sum up all allowable costs from matched acquisitions
    const totalCostBasis = disposalMatchings.reduce(
      (sum, matching) => sum + matching.totalCostBasisGbp,
      0
    )

    // Calculate gain or loss
    const gainOrLoss = netProceeds - totalCostBasis

    records.push({
      id: `disposal-${disposalId}`,
      disposal,
      matchings: disposalMatchings,
      proceedsGbp: netProceeds,
      allowableCostsGbp: totalCostBasis,
      gainOrLossGbp: gainOrLoss,
      taxYear: disposal.tax_year,
    })
  }

  // Sort by date
  return records.sort((a, b) => a.disposal.date.localeCompare(b.disposal.date))
}

/**
 * Generate tax year summaries from disposal records
 */
function generateTaxYearSummaries(disposals: DisposalRecord[]): TaxYearSummary[] {
  // Group disposals by tax year
  const byTaxYear = new Map<string, DisposalRecord[]>()

  for (const disposal of disposals) {
    const taxYear = disposal.taxYear
    if (!byTaxYear.has(taxYear)) {
      byTaxYear.set(taxYear, [])
    }
    byTaxYear.get(taxYear)!.push(disposal)
  }

  // Create summary for each tax year
  const summaries: TaxYearSummary[] = []

  for (const [taxYear, yearDisposals] of byTaxYear) {
    const { startDate, endDate } = getTaxYearBounds(taxYear)

    // Calculate totals
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

    summaries.push({
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
    })
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
