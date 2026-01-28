/**
 * Broker Registry - Central source of truth for all broker definitions
 *
 * This file aggregates all broker definitions and provides utility functions
 * for accessing broker metadata throughout the application.
 */

import { BrokerType } from '../../types/broker'
import { BrokerDefinition } from '../../types/brokerDefinition'

// Import all broker definitions
import { schwabDefinition } from './schwab'
import { schwabEquityAwardsDefinition } from './schwabEquityAwards'
import { interactiveBrokersDefinition } from './interactiveBrokers'
import { trading212Definition } from './trading212'
import { freetradeDefinition } from './freetrade'
import { equatePlusDefinition } from './equatePlus'
import { revolutDefinition } from './revolut'
import { coinbaseDefinition } from './coinbase'
import { coinbaseProDefinition } from './coinbasePro'
import { genericDefinition } from './generic'

/**
 * All broker definitions in an array
 * Used for iteration and building the registry
 */
const ALL_BROKER_DEFINITIONS: BrokerDefinition[] = [
  schwabDefinition,
  schwabEquityAwardsDefinition,
  interactiveBrokersDefinition,
  trading212Definition,
  freetradeDefinition,
  equatePlusDefinition,
  revolutDefinition,
  coinbaseDefinition,
  coinbaseProDefinition,
  genericDefinition,
]

/**
 * Map of BrokerType to BrokerDefinition for O(1) lookup
 */
export const BROKER_REGISTRY: Map<BrokerType, BrokerDefinition> = new Map(
  ALL_BROKER_DEFINITIONS.map(def => [def.type, def])
)

/**
 * Get broker definition by type
 * @param type BrokerType enum value
 * @returns BrokerDefinition or undefined if not found
 */
export function getBrokerDefinition(type: BrokerType): BrokerDefinition | undefined {
  return BROKER_REGISTRY.get(type)
}

/**
 * Get all broker definitions sorted by detection priority (lower = higher priority)
 * Used by broker detection to check more specific formats first
 * @returns Array of BrokerDefinitions sorted by priority
 */
export function getBrokerDefinitionsSortedByPriority(): BrokerDefinition[] {
  return [...ALL_BROKER_DEFINITIONS]
    .filter(def => def.enabled !== false)
    .sort((a, b) => (a.detection.priority ?? 50) - (b.detection.priority ?? 50))
}

/**
 * Get all enabled broker definitions
 * @returns Array of enabled BrokerDefinitions
 */
export function getEnabledBrokerDefinitions(): BrokerDefinition[] {
  return ALL_BROKER_DEFINITIONS.filter(def => def.enabled !== false)
}

/**
 * Get display name for a broker type
 * @param type BrokerType enum value
 * @returns Display name string, or the enum value if not found
 */
export function getBrokerDisplayName(type: BrokerType): string {
  const definition = BROKER_REGISTRY.get(type)
  return definition?.displayName ?? type
}

// Re-export individual definitions for direct access if needed
export {
  schwabDefinition,
  schwabEquityAwardsDefinition,
  interactiveBrokersDefinition,
  trading212Definition,
  freetradeDefinition,
  equatePlusDefinition,
  revolutDefinition,
  coinbaseDefinition,
  coinbaseProDefinition,
  genericDefinition,
}
