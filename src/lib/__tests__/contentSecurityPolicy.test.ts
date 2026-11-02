// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../../..')
const DATA_SOURCE_DIRS = ['src/lib/fx/providers', 'src/lib/splits']

/**
 * The policy lives in vite.config.ts, which belongs to the Node TypeScript
 * project and can't be imported from src, so it is read as text.
 */
const viteConfig = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8')

function connectSources(): string[] {
  const block = /CONNECT_SOURCES = \[([\s\S]*?)\]/.exec(viteConfig)
  if (!block) throw new Error('CONNECT_SOURCES not found in vite.config.ts')
  return [...block[1].matchAll(/'(https:\/\/[^']+)'/g)].map(m => m[1])
}

/** Hosts used in string literals (not comments) of the files that fetch data */
function fetchedHosts(): Set<string> {
  const hosts = new Set<string>()
  for (const dir of DATA_SOURCE_DIRS) {
    for (const file of readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.ts'))) {
      for (const line of readFileSync(join(ROOT, dir, file), 'utf8').split('\n')) {
        if (/^\s*(\*|\/\/)/.test(line)) continue
        for (const match of line.matchAll(/['"`](https:\/\/[a-z0-9.-]+)/gi)) hosts.add(match[1])
      }
    }
  }
  return hosts
}

describe('Content-Security-Policy', () => {
  it('allows every host the app fetches data from', () => {
    const allowed = connectSources()
    const hosts = fetchedHosts()
    expect(hosts.size).toBeGreaterThan(0)
    for (const host of hosts) {
      expect(allowed).toContain(host)
    }
  })

  it('blocks scripts from other origins, eval and plugins', () => {
    expect(viteConfig).toContain(`"script-src 'self' 'wasm-unsafe-eval'"`)
    // 'unsafe-eval' anywhere, other than as part of 'wasm-unsafe-eval'
    expect(viteConfig).not.toMatch(/(?<!wasm-)'unsafe-eval'/)
    expect(viteConfig).toContain(`"object-src 'none'"`)
  })
})
