import { EnrichedTransaction, MatchingRule } from '../types/transaction'
import { DisposalRecord, Section104Pool } from '../types/cgt'
import type { HelpContext } from '../utils/helpContent'
import { formatGbp } from '../utils/currency'
import { formatQuantity } from '../utils/quantity'
import { getUnitLabel, isAcquisition, isDisposal } from './cgt/utils'

/** What a badge in the transaction list's CGT column stands for */
export type BadgeKind = MatchingRule | 'INCOMPLETE'

/** Label, colours and help-panel topic for each kind of badge */
export const BADGE_META: Record<BadgeKind, { label: string; className: string; helpContext: HelpContext }> = {
  INCOMPLETE: { label: 'Incomplete', className: 'bg-red-100 text-red-800 border-red-300', helpContext: 'incomplete' },
  SAME_DAY: { label: 'Same Day', className: 'bg-blue-100 text-blue-800 border-blue-300', helpContext: 'same-day' },
  '30_DAY': { label: '30-Day', className: 'bg-orange-100 text-orange-800 border-orange-300', helpContext: '30-day' },
  SHORT_SELL: { label: 'Short Sell', className: 'bg-pink-100 text-pink-800 border-pink-300', helpContext: 'default' },
  SECTION_104: { label: 'Section 104', className: 'bg-green-100 text-green-800 border-green-300', helpContext: 'section104' },
}

export interface CGTBadge {
  kind: BadgeKind
  label: string
  className: string
  helpContext: HelpContext
  /** Tooltip text */
  title: string
}

/**
 * Lookups built once per calculation, so each row's badges don't rescan
 * every disposal and matching.
 */
export interface BadgeIndex {
  disposalsById: Map<string, DisposalRecord>
  /** For each acquisition: quantity matched under each rule */
  acquisitionMatches: Map<string, Map<MatchingRule, number>>
  section104Pools: Map<string, Section104Pool>
}

export function buildBadgeIndex(
  disposals: DisposalRecord[],
  section104Pools: Map<string, Section104Pool>
): BadgeIndex {
  const disposalsById = new Map<string, DisposalRecord>()
  const acquisitionMatches = new Map<string, Map<MatchingRule, number>>()

  for (const disposal of disposals) {
    disposalsById.set(disposal.disposal.id, disposal)
    for (const matching of disposal.matchings) {
      for (const acq of matching.acquisitions) {
        let byRule = acquisitionMatches.get(acq.transaction.id)
        if (!byRule) {
          byRule = new Map()
          acquisitionMatches.set(acq.transaction.id, byRule)
        }
        byRule.set(matching.rule, (byRule.get(matching.rule) ?? 0) + acq.quantityMatched)
      }
    }
  }

  return { disposalsById, acquisitionMatches, section104Pools }
}

/**
 * The CGT badges for one transaction: the rules that matched it, and a
 * warning when a disposal could not be fully matched.
 */
export function buildCGTBadges(tx: EnrichedTransaction, index: BadgeIndex): CGTBadge[] {
  if (isDisposal(tx)) return disposalBadges(tx, index)
  if (isAcquisition(tx)) return acquisitionBadges(tx, index)
  return []
}

function disposalBadges(tx: EnrichedTransaction, index: BadgeIndex): CGTBadge[] {
  const disposal = index.disposalsById.get(tx.id)
  if (!disposal) return []

  const units = getUnitLabel(tx)
  const badges: CGTBadge[] = []

  if (disposal.isIncomplete && disposal.unmatchedQuantity) {
    badges.push(badge('INCOMPLETE',
      `Warning: ${quantityText(disposal.unmatchedQuantity, tx)} could not be matched to any acquisitions. ` +
      `Missing acquisition data - did you buy ${units} before you started importing transactions?`))
  }

  for (const matching of disposal.matchings) {
    const quantity = quantityText(matching.quantityMatched, tx)
    switch (matching.rule) {
      case 'SAME_DAY':
        badges.push(badge('SAME_DAY', `Same Day: Matched ${quantity} bought on same day (TCGA92/S105(1))`))
        break
      case '30_DAY':
        badges.push(badge('30_DAY', `30-Day: Matched ${quantity} repurchased within 30 days (TCGA92/S106A(5))`))
        break
      case 'SHORT_SELL':
        badges.push(badge('SHORT_SELL', `Short Sell: ${quantity} sold short and covered by subsequent purchase`))
        break
      case 'SECTION_104': {
        // Only when some quantity was actually matched from the pool
        if (matching.quantityMatched <= 0) break
        const averageCost = matching.totalCostBasisGbp / matching.quantityMatched
        badges.push(badge('SECTION_104',
          `Section 104: Matched ${quantity} at average cost ${formatGbp(averageCost)}/${getUnitLabel(tx, false)} from pooled holdings`))
        break
      }
    }
  }

  return badges
}

function acquisitionBadges(tx: EnrichedTransaction, index: BadgeIndex): CGTBadge[] {
  const byRule = index.acquisitionMatches.get(tx.id) ?? new Map<MatchingRule, number>()
  const badges: CGTBadge[] = []
  let totalMatched = 0

  for (const [rule, matched] of byRule) {
    totalMatched += matched
    const quantity = quantityText(matched, tx)
    if (rule === 'SAME_DAY') {
      badges.push(badge('SAME_DAY', `Same Day: ${quantity} matched to same-day disposal (TCGA92/S105(1))`))
    } else if (rule === '30_DAY') {
      badges.push(badge('30_DAY', `30-Day: ${quantity} matched to disposal (bed & breakfast rule TCGA92/S106A(5))`))
    } else if (rule === 'SHORT_SELL') {
      badges.push(badge('SHORT_SELL', `Short Sell: ${quantity} used to cover a short sell`))
    }
  }

  // Whatever wasn't matched by the earlier rules went into the Section 104 pool
  const remaining = (tx.split_adjusted_quantity ?? tx.quantity ?? 0) - totalMatched
  if (remaining > 0) {
    const pool = tx.symbol ? poolAfterBuy(tx.id, index.section104Pools.get(tx.symbol)) : null
    const units = getUnitLabel(tx)
    const title = pool
      ? `Section 104: ${quantityText(remaining, tx)} added to pool (new balance: ${formatQuantity(pool.quantity)}` +
        `${hasSplit(tx) ? ' split-adjusted' : ''} ${units} at ${formatGbp(pool.averageCost)}/${getUnitLabel(tx, false)} average cost)`
      : `Section 104: ${quantityText(remaining, tx)} added to pooled holdings (TCGA92/S104)`
    badges.push(badge('SECTION_104', title))
  }

  return badges
}

/** Pool balance right after this buy was added */
function poolAfterBuy(txId: string, pool: Section104Pool | undefined) {
  const entry = pool?.history?.find(h => h.transactionId === txId && h.type === 'BUY')
  if (!entry) return null
  return {
    quantity: entry.balanceQuantity,
    averageCost: entry.balanceQuantity > 0 ? entry.balanceCost / entry.balanceQuantity : 0,
  }
}

function hasSplit(tx: EnrichedTransaction): tx is EnrichedTransaction & { split_multiplier: number } {
  return Boolean(tx.split_multiplier && tx.split_multiplier !== 1.0)
}

/**
 * "10.00 shares", or with a split "10.00 shares (20.00 split-adjusted)":
 * matching quantities are split-adjusted, the broker's statement isn't.
 */
function quantityText(splitAdjusted: number, tx: EnrichedTransaction): string {
  const units = getUnitLabel(tx)
  if (!hasSplit(tx)) return `${formatQuantity(splitAdjusted)} ${units}`
  return `${formatQuantity(splitAdjusted / tx.split_multiplier)} ${units} (${formatQuantity(splitAdjusted)} split-adjusted)`
}

function badge(kind: BadgeKind, title: string): CGTBadge {
  return { kind, ...BADGE_META[kind], title }
}
