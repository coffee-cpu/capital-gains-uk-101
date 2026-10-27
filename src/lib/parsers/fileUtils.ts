/**
 * Read a browser File as text.
 *
 * Browser-only (uses FileReader). Core parsing code works on strings so it can
 * also run under Node; only UI code should call this.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string) ?? '')
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

/**
 * Hook a parser module can export to participate in raw-file preprocessing
 * (e.g. flattening IB's multi-section format, stripping Coinbase metadata rows).
 *
 * The dispatcher (`preprocessCSVText` in csvParser.ts) iterates registered
 * preprocessors in order; the first one whose `matches()` returns true wins.
 */
export interface CSVPreprocessor {
  /** Returns true if this preprocessor applies to the given raw file content. */
  matches(text: string): boolean
  /** Transforms the raw content into a shape PapaParse can consume with `header: true`. */
  apply(text: string): string
}
