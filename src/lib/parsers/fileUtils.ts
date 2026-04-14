/**
 * Read the first N bytes of a file as text.
 * Used by parser preprocessors to sniff raw file content before CSV parsing.
 */
export function readFileHead(file: File, bytes: number): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string) || null)
    reader.onerror = () => resolve(null)
    reader.readAsText(file.slice(0, bytes))
  })
}

/**
 * Hook a parser module can export to participate in raw-file preprocessing
 * (e.g. flattening IB's multi-section format, stripping Coinbase metadata rows).
 *
 * The dispatcher (`preprocessCSVFile` in csvParser.ts) iterates registered
 * preprocessors in order; the first one whose `matches()` returns true wins.
 */
export interface CSVPreprocessor {
  /** Returns true if this preprocessor applies to the given raw file. */
  matches(file: File): Promise<boolean>
  /** Transforms the raw file into a shape PapaParse can consume with `header: true`. */
  apply(file: File): Promise<File>
}
