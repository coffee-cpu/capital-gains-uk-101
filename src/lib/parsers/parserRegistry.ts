/**
 * Parser Registry
 *
 * Delegates to the central broker registry for parser functions.
 * This file maintains backward compatibility with existing code.
 */

import { BrokerType, RawCSVRow } from '../../types/broker'
import { GenericTransaction } from '../../types/transaction'
import { getBrokerDefinition, getBrokerDisplayName } from '../../config/brokers'

/**
 * Parser function signature (legacy - for backward compatibility)
 * New code should use ParserFunction from brokerDefinition.ts
 */
export type ParserFunction = (rows: RawCSVRow[], fileId: string) => GenericTransaction[]

/**
 * Get parser function for a broker type
 * Returns a wrapper that passes the display name to the parser
 * @param broker BrokerType enum value
 * @returns Parser function or null if broker is unknown or unsupported
 */
export function getParser(broker: BrokerType): ParserFunction | null {
  if (broker === BrokerType.UNKNOWN) {
    return null
  }

  const definition = getBrokerDefinition(broker)
  if (!definition || definition.enabled === false) {
    return null
  }

  // Return a wrapper that passes the display name to the parser
  const displayName = getBrokerDisplayName(broker)
  return (rows: RawCSVRow[], fileId: string) => definition.parser(rows, fileId, displayName)
}
