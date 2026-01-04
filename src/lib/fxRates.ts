/**
 * DEPRECATED: This file is deprecated.
 * Use the new FX module instead: import { ... } from './fx'
 *
 * This file re-exports from the new module for backward compatibility.
 *
 * @deprecated Use import { ... } from './fx' instead
 */

import { HMRCMonthlyProvider } from './fx/providers/hmrcMonthly'
export { convertToGBP } from './fx'

const provider = new HMRCMonthlyProvider()

/**
 * @deprecated Use FXManager from './fx' instead
 */
export async function getFXRate(date: string, currency: string): Promise<number> {
  const result = await provider.getRate(date, currency)
  return result.rate
}
