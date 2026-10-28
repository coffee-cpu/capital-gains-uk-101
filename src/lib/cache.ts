import { FXSource } from '../types/fxSource'

/**
 * FX rate cache entry
 */
export interface FXRate {
  id: string // Composite key: source-date-currency (e.g., 'HMRC_MONTHLY-2025-05-USD')
  date: string // Date key (format varies by source: YYYY-MM, YYYY, or YYYY-MM-DD)
  currency: string // e.g. 'USD'
  rate: number // GBP conversion rate
  source: string // e.g. 'HMRC Monthly Exchange Rates'
  fxSource?: FXSource // Which FX source this rate belongs to (optional for backward compat)
}

/**
 * Cached stock split year data from external sources (e.g., jsDelivr CDN)
 */
export interface CachedSplitYear {
  year: number // Primary key: the year (e.g., 2024)
  data: string // JSON-encoded split data for the year
  fetchedAt: string // ISO timestamp of when data was fetched
}

/**
 * Minimal record store used for caching fetched reference data.
 *
 * Shaped so a Dexie `Table` satisfies it directly, which lets the browser keep
 * using IndexedDB while other runtimes (e.g. the CLI) plug in their own store.
 */
export interface RecordCache<K, V> {
  get(key: K): Promise<V | undefined>
  put(record: V): Promise<unknown>
  bulkPut(records: V[]): Promise<unknown>
}

/**
 * In-memory RecordCache. Used by default, so core code works without any setup.
 */
export class MemoryRecordCache<K, V> implements RecordCache<K, V> {
  private readonly records = new Map<K, V>()

  constructor(private readonly keyOf: (record: V) => K) {}

  async get(key: K): Promise<V | undefined> {
    return this.records.get(key)
  }

  async put(record: V): Promise<void> {
    this.records.set(this.keyOf(record), record)
  }

  async bulkPut(records: V[]): Promise<void> {
    for (const record of records) {
      this.records.set(this.keyOf(record), record)
    }
  }
}

export interface CacheBackends {
  fxRates: RecordCache<string, FXRate>
  splitData: RecordCache<number, CachedSplitYear>
}

export function createMemoryCacheBackends(): CacheBackends {
  return {
    fxRates: new MemoryRecordCache<string, FXRate>(rate => rate.id),
    splitData: new MemoryRecordCache<number, CachedSplitYear>(entry => entry.year),
  }
}

let backends: CacheBackends = createMemoryCacheBackends()

/**
 * Replace the cache backends used by FX providers and the split data source.
 * The web app registers its IndexedDB tables at startup (see `registerIndexedDBCaches`).
 */
export function setCacheBackends(next: CacheBackends): void {
  backends = next
}

export function getFxRateCache(): RecordCache<string, FXRate> {
  return backends.fxRates
}

export function getSplitDataCache(): RecordCache<number, CachedSplitYear> {
  return backends.splitData
}
