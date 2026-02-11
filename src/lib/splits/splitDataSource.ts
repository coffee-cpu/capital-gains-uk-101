import { db } from '../db'

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
 * Fetches stock split data from the coffee-cpu/stock-splits-data repo via jsDelivr CDN.
 *
 * - Maps CDN ratioNew/ratioOld fields to internal ratioTo/ratioFrom
 * - Uses IndexedDB (split_data_cache table) for caching with 7-day TTL
 * - On network failure, falls back to stale cache if available
 * - 404s (year file doesn't exist) are handled silently
 */
export class JsDelivrSplitSource implements SplitDataSource {
  private readonly baseUrl = 'https://cdn.jsdelivr.net/gh/coffee-cpu/stock-splits-data@main/data'

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
      return this.parseCdnData(cached.data)
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
      await db.split_data_cache.put({
        year,
        data: text,
        fetchedAt: new Date().toISOString(),
      })

      return this.parseCdnData(text)
    } catch {
      // Network failure: use stale cache if available
      if (cached) {
        return this.parseCdnData(cached.data)
      }
      return []
    }
  }

  private async getCached(year: number) {
    try {
      return await db.split_data_cache.get(year)
    } catch {
      return undefined
    }
  }

  private isStale(fetchedAt: string): boolean {
    const age = Date.now() - new Date(fetchedAt).getTime()
    return age > CACHE_TTL_MS
  }

  private parseCdnData(jsonText: string): SplitRecord[] {
    try {
      const data: CdnSplitYearData = JSON.parse(jsonText)
      if (!data.splits || !Array.isArray(data.splits)) {
        return []
      }
      return data.splits
        .map(s => this.parseCdnRecord(s))
        .filter((r): r is SplitRecord => r !== null)
    } catch {
      return []
    }
  }

  private parseCdnRecord(record: CdnSplitRecord): SplitRecord | null {
    if (!record.symbol || !record.date) {
      return null
    }

    const ratioTo = record.ratioNew
    const ratioFrom = record.ratioOld

    if (!ratioTo || !ratioFrom || ratioFrom === 0 || ratioTo === 0) {
      return null
    }

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
