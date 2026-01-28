/**
 * Parser Registry
 *
 * Delegates to the central broker registry for parser functions.
 */

import { BrokerType } from '../../types/broker'
import { ParserFunction } from '../../types/brokerDefinition'
import { getBrokerDefinition } from '../../config/brokers'

export type { ParserFunction }

/**
 * Get parser function for a broker type
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

  return definition.parser
}
