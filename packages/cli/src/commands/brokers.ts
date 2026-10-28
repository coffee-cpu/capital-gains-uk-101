import { getEnabledBrokerDefinitions } from '../../../../src/config/brokers'
import { WEB_APP_URL } from '../meta'

export interface BrokerInfo {
  id: string
  name: string
  exportSteps: string[]
  notes: string[]
  exampleFile: string
}

/** Supported formats, with the same export instructions the web app shows */
export function listBrokers(): BrokerInfo[] {
  return getEnabledBrokerDefinitions().map(def => ({
    id: def.shortId,
    name: def.displayName,
    exportSteps: def.instructions.steps,
    notes: [
      ...(def.instructions.notes ?? []),
      ...[def.instructions.info, def.instructions.warning].filter((note): note is string => Boolean(note)),
    ],
    exampleFile: `${WEB_APP_URL}${def.exampleFile}`,
  }))
}

export function formatBrokersText(brokers: BrokerInfo[]): string {
  const lines: string[] = []
  for (const broker of brokers) {
    lines.push(`${broker.name} (${broker.id})`)
    broker.exportSteps.forEach((step, i) => lines.push(`  ${i + 1}. ${step}`))
    for (const note of broker.notes) {
      lines.push(`  - ${note}`)
    }
    lines.push(`  Example: ${broker.exampleFile}`)
    lines.push('')
  }
  return lines.join('\n')
}
