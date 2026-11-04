/**
 * Combine the exchange-rate attributions on transactions into one label per
 * source, for report headers and footers.
 *
 * One source can carry a qualifier per host, e.g. "HMRC Monthly Exchange
 * Rates (gov.uk)" and "HMRC Monthly Exchange Rates (2015-2020 archive)".
 * Those become "HMRC Monthly Exchange Rates (2015-2020 archive and gov.uk)".
 * A label without a qualifier (cached by an earlier version) adds nothing.
 */
export function combineFxAttributions(labels: Iterable<string>): string[] {
  const qualifiersBySource = new Map<string, Set<string>>()
  for (const label of labels) {
    const match = /^(.*\S) \(([^()]+)\)$/.exec(label)
    const [source, qualifier] = match ? [match[1], match[2]] : [label, null]
    if (!qualifiersBySource.has(source)) qualifiersBySource.set(source, new Set())
    if (qualifier) qualifiersBySource.get(source)!.add(qualifier)
  }
  return [...qualifiersBySource]
    .map(([source, qualifiers]) =>
      qualifiers.size > 0 ? `${source} (${[...qualifiers].sort().join(' and ')})` : source
    )
    .sort()
}
