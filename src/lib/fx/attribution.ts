/**
 * Combine the exchange-rate attributions on transactions into one label per
 * source, for report headers and footers.
 *
 * One source can carry a qualifier per host, e.g. "HMRC Monthly Exchange
 * Rates (gov.uk)" and "HMRC Monthly Exchange Rates (2015-2020 archive)".
 * Those become "HMRC Monthly Exchange Rates (2015-2020 archive and gov.uk)".
 *
 * A label without a qualifier was cached by an earlier version (used when
 * the source can't be reached). Alone it stays as it is; next to qualified
 * labels it's named, so the combined label never hides that it was used.
 */
export function combineFxAttributions(labels: Iterable<string>): string[] {
  const sources = new Map<string, { qualifiers: Set<string>; plain: boolean }>()
  for (const label of labels) {
    const match = /^(.*\S) \(([^()]+)\)$/.exec(label)
    const name = match ? match[1] : label
    const entry = sources.get(name) ?? { qualifiers: new Set<string>(), plain: false }
    if (match) entry.qualifiers.add(match[2])
    else entry.plain = true
    sources.set(name, entry)
  }
  return [...sources]
    .map(([name, { qualifiers, plain }]) => {
      if (qualifiers.size === 0) return name
      const parts = [...qualifiers].sort()
      if (plain) parts.push('cached by an earlier version')
      return `${name} (${parts.join(' and ')})`
    })
    .sort()
}
