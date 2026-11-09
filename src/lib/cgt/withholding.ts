import { BrokerType } from '../../types/broker'
import { EnrichedTransaction } from '../../types/transaction'

/**
 * Tax withheld by a TAX_ON_DIVIDEND or TAX_ON_INTEREST row, in GBP.
 *
 * Parsers keep amounts as the broker reports them (see CLAUDE.md, "raw data
 * only"), so the brokers' sign conventions differ and are read here, in one
 * place, rather than in the CGT engine:
 * - Interactive Brokers keeps the cash-movement sign: negative is tax
 *   withheld, positive is a reversal of earlier withholding.
 * - Other sources (e.g. Schwab NRA Tax Adj) only report withholding, so any
 *   sign counts as tax withheld.
 */
export function withheldAmountGbp(tx: EnrichedTransaction): number {
  const value = tx.value_gbp ?? 0
  return SIGNED_WITHHOLDING_SOURCES.has(tx.source) ? -value : Math.abs(value)
}

/** Sources whose withholding rows carry a sign (negative = withheld) */
const SIGNED_WITHHOLDING_SOURCES = new Set<string>([BrokerType.INTERACTIVE_BROKERS])
