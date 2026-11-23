import { GenericTransaction, EnrichedTransaction, FX_STATUS } from '../../types/transaction'
import { FXSource, DEFAULT_FX_SOURCE } from '../../types/fxSource'
import { SplitEnricher } from './enrichers/splitEnricher'
import { FxEnricher } from './enrichers/fxEnricher'
import { TaxYearEnricher } from './enrichers/taxYearEnricher'

// Kept across runs so their in-memory caches (e.g. FX rates) are reused.
// One FX enricher per source, created on first use.
const splitEnricher = new SplitEnricher()
const taxYearEnricher = new TaxYearEnricher()
const fxEnrichers = new Map<FXSource, FxEnricher>()

function getFxEnricher(fxSource: FXSource): FxEnricher {
  let enricher = fxEnrichers.get(fxSource)
  if (!enricher) {
    enricher = new FxEnricher(fxSource)
    fxEnrichers.set(fxSource, enricher)
  }
  return enricher
}

/**
 * Enrich transactions with computed fields, in three passes (each can use
 * the fields the earlier ones set):
 * 1. Stock split adjustments (HMRC TCGA92/S127) - normalize quantities to post-split units
 * 2. FX conversion - convert to GBP using the selected source
 * 3. Tax year - assign UK tax years
 *
 * Withholding tax (e.g., NRA Tax Adj) is handled via typed transaction types
 * (TAX_ON_DIVIDEND, TAX_ON_INTEREST) and summed at the CGT engine level.
 *
 * @param transactions Array of generic transactions (raw parsed data from CSV)
 * @param fxSource Optional FX source to use (defaults to HMRC_MONTHLY)
 * @returns Array of enriched transactions with all computed fields
 */
export async function enrichTransactions(
  transactions: GenericTransaction[],
  fxSource: FXSource = DEFAULT_FX_SOURCE
): Promise<EnrichedTransaction[]> {
  const withSplits = await splitEnricher.enrich(transactions.map(withEnrichedDefaults))
  const withFx = await getFxEnricher(fxSource).enrich(withSplits)
  return taxYearEnricher.enrich(withFx)
}

/** A transaction with every enriched field at its "not computed yet" value */
function withEnrichedDefaults(tx: GenericTransaction): EnrichedTransaction {
  return {
    ...tx,
    // Stock split adjustments (pass 1)
    split_adjusted_quantity: null,
    split_adjusted_price: null,
    split_multiplier: 1.0,
    applied_splits: [],
    // FX conversion (pass 2)
    fx_rate: null,
    price_gbp: null,
    value_gbp: null,
    fee_gbp: null,
    fx_source: FX_STATUS.PENDING,
    fx_error: null,
    // Tax year (pass 3); match_groups are set later by the CGT engine
    tax_year: '',
    match_groups: [],
  }
}
