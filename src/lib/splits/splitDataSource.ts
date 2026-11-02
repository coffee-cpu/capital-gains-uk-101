import { getSplitDataCache } from '../cache'

/**
 * A parsed stock split record with typed ratio fields.
 */
export interface SplitRecord {
  symbol: string
  name?: string
  date: string       // YYYY-MM-DD
  ratioFrom: number  // old shares (e.g., 1 in a 5-for-1 split)
  ratioTo: number    // new shares (e.g., 5 in a 5-for-1 split)
  isin?: string
  exchange?: string
  source?: string
  notes?: string
}

/**
 * Raw CDN split record shape (ratioNew/ratioOld integer fields).
 */
interface CdnSplitRecord {
  symbol: string
  name?: string
  date: string
  ratioNew: number  // new shares received (e.g., 4 for a 4-for-1 split)
  ratioOld: number  // old shares exchanged (e.g., 1 for a 4-for-1 split)
  isin?: string
  exchange?: string
  source?: string
  notes?: string
}

/**
 * Shape of a year file from the CDN.
 */
interface CdnSplitYearData {
  year: number
  updated: string
  splits: CdnSplitRecord[]
}

/**
 * Generic interface for fetching stock split data.
 * Implementations are responsible for caching and network handling.
 */
export interface SplitDataSource {
  fetchSplitsForYears(years: number[]): Promise<SplitRecord[]>
}

/** Cache TTL: 7 days in milliseconds */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Largest split multiplier accepted from fetched data, either way (1000:1 or
 * 1:1000). Real splits sit well inside this (forward splits up to about 20:1,
 * reverse splits rarely beyond 1:250); anything larger is bad data.
 */
export const MAX_SPLIT_MULTIPLIER = 1000

/**
 * Validate a fetched split record before it can change quantities.
 *
 * Fetched data changes every holding of the symbol, so a malformed record is
 * dropped rather than trusted:
 * - ratio sides must be positive finite numbers within MAX_SPLIT_MULTIPLIER
 * - the date must be a real YYYY-MM-DD date inside the year file it came from
 * - the date must not be in the future: an announced split that hasn't taken
 *   effect yet would otherwise multiply every current holding now
 *
 * @param today ISO date (YYYY-MM-DD) to compare against; defaults to now (UTC)
 */
export function isValidSplitRecord(
  record: { symbol?: unknown; date?: unknown; ratioNew?: unknown; ratioOld?: unknown },
  year: number,
  today: string = new Date().toISOString().slice(0, 10)
): boolean {
  if (typeof record.symbol !== 'string' || !record.symbol.trim()) return false
  if (typeof record.date !== 'string') return false

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(record.date)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const parsed = new Date(Date.UTC(y, m - 1, d))
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return false
  if (y !== year) return false
  if (record.date > today) return false

  const { ratioNew, ratioOld } = record
  if (typeof ratioNew !== 'number' || typeof ratioOld !== 'number') return false
  if (!Number.isFinite(ratioNew) || !Number.isFinite(ratioOld) || ratioNew <= 0 || ratioOld <= 0) return false
  const multiplier = ratioNew / ratioOld
  return multiplier <= MAX_SPLIT_MULTIPLIER && multiplier >= 1 / MAX_SPLIT_MULTIPLIER
}

/**
 * Fetches stock split data from the coffee-cpu/stock-splits-data repo via jsDelivr CDN.
 *
 * - Maps CDN ratioNew/ratioOld fields to internal ratioTo/ratioFrom
 * - Caches responses (IndexedDB in the browser, see `cache.ts`) with a 7-day TTL
 * - On network failure, falls back to stale cache if available
 * - 404s (year file doesn't exist) are handled silently
 * - Years that could be neither fetched nor read from cache are recorded in
 *   `unavailableYears`, so callers can report that splits may be missing
 */
export class JsDelivrSplitSource implements SplitDataSource {
  private readonly baseUrl = 'https://cdn.jsdelivr.net/gh/coffee-cpu/stock-splits-data@main/data'

  /** Years whose split data could not be fetched and had no cached copy */
  readonly unavailableYears = new Set<number>()

  async fetchSplitsForYears(years: number[]): Promise<SplitRecord[]> {
    const results = await Promise.all(
      years.map(year => this.fetchYear(year))
    )
    return results.flat()
  }

  private async fetchYear(year: number): Promise<SplitRecord[]> {
    // Check cache first
    const cached = await this.getCached(year)
    if (cached && !this.isStale(cached.fetchedAt)) {
      return this.parseCdnData(cached.data, year)
    }

    // Fetch from CDN
    try {
      const response = await fetch(`${this.baseUrl}/${year}.json`)

      if (response.status === 404) {
        // Year file doesn't exist — not an error
        return []
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const text = await response.text()

      // Cache the raw response
      await getSplitDataCache().put({
        year,
        data: text,
        fetchedAt: new Date().toISOString(),
      })

      return this.parseCdnData(text, year)
    } catch {
      // Network failure: use stale cache if available
      if (cached) {
        return this.parseCdnData(cached.data, year)
      }
      this.unavailableYears.add(year)
      return []
    }
  }

  private async getCached(year: number) {
    try {
      return await getSplitDataCache().get(year)
    } catch {
      return undefined
    }
  }

  private isStale(fetchedAt: string): boolean {
    const age = Date.now() - new Date(fetchedAt).getTime()
    return age > CACHE_TTL_MS
  }

  private parseCdnData(jsonText: string, year: number): SplitRecord[] {
    try {
      const data: CdnSplitYearData = JSON.parse(jsonText)
      if (!data.splits || !Array.isArray(data.splits)) {
        return []
      }
      return data.splits
        .map(s => this.parseCdnRecord(s, year))
        .filter((r): r is SplitRecord => r !== null)
    } catch {
      return []
    }
  }

  private parseCdnRecord(record: CdnSplitRecord, year: number): SplitRecord | null {
    if (!isValidSplitRecord(record, year)) {
      return null
    }

    const ratioTo = record.ratioNew
    const ratioFrom = record.ratioOld

    return {
      symbol: record.symbol,
      name: record.name,
      date: record.date,
      ratioFrom,
      ratioTo,
      isin: record.isin,
      exchange: record.exchange,
      source: record.source,
      notes: record.notes,
    }
  }
}
