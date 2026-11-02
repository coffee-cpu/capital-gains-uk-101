import type { DisposalRecord } from '../../types/cgt'
import type { EnrichedTransaction, GenericTransaction } from '../../types/transaction'
import { isFiatCurrency } from '../currencies'

/**
 * SA108 figures: how disposals are counted and totalled on the capital gains
 * summary pages.
 *
 * Shared by the engine's tax year totals, the PDF report and the CLI so every
 * surface reports the same numbers.
 */

/**
 * Net gain or loss per disposal as HMRC counts them.
 *
 * All disposals of the same asset on the same day are a single disposal
 * (TCGA92/S105(1)(a)), so the engine's per-sale records are combined by
 * symbol and date before counting or splitting into gains and losses.
 */
export function netSameDayGains(disposals: DisposalRecord[]): number[] {
  const netByDisposal = new Map<string, number>()
  for (const d of disposals) {
    const key = `${d.disposal.symbol}|${d.disposal.date}`
    netByDisposal.set(key, (netByDisposal.get(key) ?? 0) + d.gainOrLossGbp)
  }
  return [...netByDisposal.values()]
}

/** Total gains and total losses (as a positive amount) from per-disposal nets */
export function splitGainsAndLosses(nets: number[]): { gainsGbp: number; lossesGbp: number } {
  return {
    gainsGbp: nets.reduce((total, net) => total + Math.max(0, net), 0),
    lossesGbp: nets.reduce((total, net) => total + Math.max(0, -net), 0),
  }
}


export type Sa108Category = 'LISTED_SHARES' | 'CRYPTO' | 'OPTIONS'

/** Brokers whose exports are cryptoassets. Transactions carry no asset class. */
const CRYPTO_SOURCES = new Set(['Coinbase', 'Coinbase Pro'])

/**
 * Whether a transaction is a cryptoasset, as far as the imported data can tell:
 * - the row says so (Generic CSV asset_class "crypto"), or
 * - it comes from a crypto exchange's export, or
 * - it is priced in a cryptocurrency (a listed share can't be),
 * unless the row explicitly says it is a share. Symbols aren't used: tickers
 * such as ETH are also listed shares.
 */
export function isCryptoasset(tx: Pick<GenericTransaction, 'source' | 'currency' | 'asset_class'>): boolean {
  if (tx.asset_class === 'crypto') return true
  if (tx.asset_class === 'share') return false
  return CRYPTO_SOURCES.has(tx.source) || !isFiatCurrency(tx.currency)
}

/** Which SA108 section a disposal belongs in, as far as the imported data can tell */
export function sa108Category(tx: EnrichedTransaction): Sa108Category {
  if (tx.underlying_symbol != null) return 'OPTIONS'
  if (isCryptoasset(tx)) return 'CRYPTO'
  return 'LISTED_SHARES'
}

export interface Sa108Boxes {
  number: string
  proceeds: string
  costs: string
  gains: string
  losses: string
}

const LISTED_SHARES_BOXES: Sa108Boxes = { number: '23', proceeds: '24', costs: '25', gains: '26', losses: '27' }
const OTHER_ASSETS_BOXES: Sa108Boxes = { number: '14', proceeds: '15', costs: '16', gains: '17', losses: '19' }
const CRYPTO_BOXES: Sa108Boxes = { number: '13.1', proceeds: '13.2', costs: '13.3', gains: '13.4', losses: '13.5' }

/**
 * SA108 box numbers, checked against HMRC's published forms. HMRC renumbers
 * the form from time to time, so years not listed here print section names
 * only. Cryptoassets had no section of their own before 2024/25 and went in
 * "Other property, assets and gains".
 *
 * Sources: SA108 2024 (2023/24), SA108 2025 (2024/25) and SA108 2026 (2025/26),
 * https://www.gov.uk/government/publications/self-assessment-capital-gains-summary-sa108
 */
const SA108_BOXES: Record<string, { LISTED_SHARES: Sa108Boxes; CRYPTO: Sa108Boxes }> = {
  '2023/24': { LISTED_SHARES: LISTED_SHARES_BOXES, CRYPTO: OTHER_ASSETS_BOXES },
  '2024/25': { LISTED_SHARES: LISTED_SHARES_BOXES, CRYPTO: CRYPTO_BOXES },
  '2025/26': { LISTED_SHARES: LISTED_SHARES_BOXES, CRYPTO: CRYPTO_BOXES },
}

function cryptoSection(taxYear: string): string {
  return parseInt(taxYear.slice(0, 4)) >= 2024 ? 'Cryptoassets' : 'Other property, assets and gains'
}

export interface Sa108Row {
  category: Sa108Category
  /** What the row covers, e.g. "Shares and funds" */
  label: string
  /** SA108 section name, or null when the report doesn't decide it */
  section: string | null
  /** Box numbers, or null when not known for this tax year */
  boxes: Sa108Boxes | null
  /** Same-day disposals of the same asset count once (TCGA92/S105(1)(a)) */
  numberOfDisposals: number
  proceedsGbp: number
  costsGbp: number
  /** Gains in the year, before losses, with same-day disposals of one asset netted */
  gainsGbp: number
  /** Losses in the year, as a positive amount */
  lossesGbp: number
}

const CATEGORY_ORDER: Sa108Category[] = ['LISTED_SHARES', 'CRYPTO', 'OPTIONS']
const CATEGORY_LABELS: Record<Sa108Category, string> = {
  LISTED_SHARES: 'Shares and funds',
  CRYPTO: 'Cryptoassets',
  OPTIONS: 'Options',
}

/** This year's disposals totalled per SA108 section */
export function sa108Rows(taxYear: string, disposals: DisposalRecord[]): Sa108Row[] {
  const boxes = SA108_BOXES[taxYear]
  return CATEGORY_ORDER.flatMap(category => {
    const inCategory = disposals.filter(d => sa108Category(d.disposal) === category)
    if (inCategory.length === 0) return []
    const sum = (f: (d: DisposalRecord) => number) => inCategory.reduce((total, d) => total + f(d), 0)
    const nets = netSameDayGains(inCategory)
    return [{
      category,
      label: CATEGORY_LABELS[category],
      section:
        category === 'LISTED_SHARES' ? 'Listed shares and securities'
        : category === 'CRYPTO' ? cryptoSection(taxYear)
        : null,
      boxes: category === 'OPTIONS' || !boxes ? null : boxes[category],
      numberOfDisposals: nets.length,
      proceedsGbp: sum(d => d.proceedsGbp),
      costsGbp: sum(d => d.allowableCostsGbp),
      ...splitGainsAndLosses(nets),
    }]
  })
}
