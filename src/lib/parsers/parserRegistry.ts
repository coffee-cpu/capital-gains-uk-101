/**
 * Parser Registry
 *
 * Maps broker types to their respective parser functions.
 * This eliminates the need for switch statements when selecting parsers.
 */

import { BrokerType, RawCSVRow } from '../../types/broker'
import { GenericTransaction } from '../../types/transaction'
import { normalizeSchwabTransactions } from './schwab'
import { normalizeSchwabEquityAwardsTransactions } from './schwabEquityAwards'
import { normalizeInteractiveBrokersTransactions } from './interactiveBrokers'
import { normalizeGenericTransactions } from './generic'
import { normalizeTrading212Transactions } from './trading212'
import { normalizeFreetradeTransactions } from './freetrade'
import { normalizeEquatePlusTransactions } from './equatePlus'
import { normalizeRevolutTransactions } from './revolut'
import { normalizeCoinbaseTransactions } from './coinbase'

/**
 * Parser function signature
 */
export type ParserFunction = (rows: RawCSVRow[], fileId: string) => GenericTransaction[]

/**
 * Registry mapping broker types to parser functions
 */
export const PARSER_REGISTRY: Record<BrokerType, ParserFunction | null> = {
  [BrokerType.SCHWAB]: normalizeSchwabTransactions,
  [BrokerType.SCHWAB_EQUITY_AWARDS]: normalizeSchwabEquityAwardsTransactions,
  [BrokerType.INTERACTIVE_BROKERS]: normalizeInteractiveBrokersTransactions,
  [BrokerType.FREETRADE]: normalizeFreetradeTransactions,
  [BrokerType.EQUATE_PLUS]: normalizeEquatePlusTransactions,
  [BrokerType.REVOLUT]: normalizeRevolutTransactions,
  [BrokerType.COINBASE]: normalizeCoinbaseTransactions,
  [BrokerType.GENERIC]: normalizeGenericTransactions,
  [BrokerType.TRADING212]: normalizeTrading212Transactions,
  [BrokerType.UNKNOWN]: null,
}

/**
 * Get parser function for a broker type
 * Returns null if broker is unknown or unsupported
 */
export function getParser(broker: BrokerType): ParserFunction | null {
  return PARSER_REGISTRY[broker] ?? null
}
