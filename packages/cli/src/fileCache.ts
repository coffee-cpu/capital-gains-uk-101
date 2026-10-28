import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  CacheBackends,
  CachedSplitYear,
  FXRate,
  RecordCache,
} from '../../../src/lib/cache'

/**
 * RecordCache persisted as a JSON file. Records are loaded on first use and
 * written back by `flush()`, so a run reads and writes the file at most once.
 */
export class JsonFileRecordCache<K extends string | number, V> implements RecordCache<K, V> {
  private records: Map<string, V> | null = null
  private dirty = false

  constructor(
    private readonly filePath: string,
    private readonly keyOf: (record: V) => K
  ) {}

  async get(key: K): Promise<V | undefined> {
    return (await this.load()).get(String(key))
  }

  async put(record: V): Promise<void> {
    (await this.load()).set(String(this.keyOf(record)), record)
    this.dirty = true
  }

  async bulkPut(records: V[]): Promise<void> {
    const map = await this.load()
    for (const record of records) {
      map.set(String(this.keyOf(record)), record)
    }
    this.dirty = records.length > 0 || this.dirty
  }

  async flush(): Promise<void> {
    if (!this.dirty || !this.records) return
    await mkdir(dirname(this.filePath), { recursive: true })
    const tmpPath = `${this.filePath}.${process.pid}.tmp`
    await writeFile(tmpPath, JSON.stringify(Object.fromEntries(this.records)))
    await rename(tmpPath, this.filePath)
    this.dirty = false
  }

  private async load(): Promise<Map<string, V>> {
    if (this.records) return this.records
    try {
      const parsed: unknown = JSON.parse(await readFile(this.filePath, 'utf-8'))
      this.records = parsed && typeof parsed === 'object'
        ? new Map(Object.entries(parsed as Record<string, V>))
        : new Map()
    } catch {
      // Missing or corrupt cache: start empty, it is only a cache
      this.records = new Map()
    }
    return this.records
  }
}

/**
 * Cache directory: $CGT_VISUALISER_CACHE_DIR, else $XDG_CACHE_HOME/cgt-visualiser,
 * else ~/.cache/cgt-visualiser
 */
export function defaultCacheDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.CGT_VISUALISER_CACHE_DIR) return env.CGT_VISUALISER_CACHE_DIR
  const base = env.XDG_CACHE_HOME || join(homedir(), '.cache')
  return join(base, 'cgt-visualiser')
}

export interface FileCacheBackends extends CacheBackends {
  flush(): Promise<void>
}

export function createFileCacheBackends(cacheDir: string): FileCacheBackends {
  const fxRates = new JsonFileRecordCache<string, FXRate>(join(cacheDir, 'fx-rates.json'), rate => rate.id)
  const splitData = new JsonFileRecordCache<number, CachedSplitYear>(join(cacheDir, 'split-data.json'), entry => entry.year)
  return {
    fxRates,
    splitData,
    async flush() {
      await Promise.all([fxRates.flush(), splitData.flush()])
    },
  }
}
