import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { buildGuideSite } from '..'
import { WORKED_EXAMPLES, WorkedExample, exampleToGenericCsv } from '../examples'
import { importCSVText } from '../../lib/import'
import { runPipeline } from '../../lib/pipeline'
import { createMemoryCacheBackends, setCacheBackends } from '../../lib/cache'
import { getEnabledBrokerDefinitions } from '../../config/brokers'
import { brokerGuidePath } from '../brokers'
import { GainGroup } from '../../types/transaction'

const PUBLIC_DIR = join(__dirname, '../../../public')

const RULE_IDS = {
  [GainGroup.SAME_DAY]: 'same-day',
  [GainGroup.THIRTY_DAY]: '30-day',
  [GainGroup.SECTION_104]: 'section-104',
} as const

describe('guide worked examples', () => {
  beforeEach(() => setCacheBackends(createMemoryCacheBackends()))

  // The pages show these figures, so they must be what the calculator produces
  it.each(Object.entries(WORKED_EXAMPLES))('%s matches the calculation engine', async (_name, example: WorkedExample) => {
    const { transactions } = importCSVText(exampleToGenericCsv(example), 'example')
    const result = await runPipeline(transactions, { autoSplits: false })

    expect(result!.disposals).toHaveLength(1)
    const [disposal] = result!.disposals
    expect(disposal.disposal.date).toBe(example.disposal.date)
    expect(disposal.proceedsGbp).toBeCloseTo(example.disposal.proceedsGbp, 2)
    expect(disposal.allowableCostsGbp).toBeCloseTo(example.disposal.allowableCostsGbp, 2)
    expect(disposal.gainOrLossGbp).toBeCloseTo(example.disposal.gainOrLossGbp, 2)
    expect(disposal.isIncomplete).toBe(false)
    expect(disposal.matchings.map(m => ({
      rule: RULE_IDS[m.rule as keyof typeof RULE_IDS],
      quantity: m.quantityMatched,
      costGbp: Math.round(m.totalCostBasisGbp * 100) / 100,
    }))).toEqual(example.disposal.matches)

    const pool = result!.section104Pools.get(example.symbol)!
    expect(pool.quantity).toBeCloseTo(example.poolAfter.quantity, 6)
    expect(pool.totalCostGbp).toBeCloseTo(example.poolAfter.costGbp, 2)
  })
})

describe('buildGuideSite', () => {
  const site = buildGuideSite()
  const paths = new Set(site.pages.map(p => p.path))

  it('builds a guide for every supported broker', () => {
    for (const definition of getEnabledBrokerDefinitions()) {
      expect(paths).toContain(brokerGuidePath(definition))
    }
  })

  it('gives every page a unique title, description and path', () => {
    const titles = site.pages.map(p => p.title)
    const descriptions = site.pages.map(p => p.description)

    expect(new Set(titles).size).toBe(titles.length)
    expect(new Set(descriptions).size).toBe(descriptions.length)
    expect(paths.size).toBe(site.pages.length)
    for (const page of site.pages) {
      expect(page.path).toMatch(/^\/guides\/([a-z0-9-]+\/)?$/)
      expect(page.description.length).toBeLessThanOrEqual(170)
    }
  })

  it('writes a complete HTML document for each page', () => {
    for (const page of site.pages) {
      const html = site.files.get(`${page.path.slice(1)}index.html`)!

      expect(html).toContain(`<link rel="canonical" href="https://cgtvisualiser.co.uk${page.path}">`)
      expect(html.match(/<h1>/g)).toHaveLength(1)
      for (const [, json] of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) {
        expect(() => JSON.parse(json)).not.toThrow()
      }
    }
  })

  it('only links to pages and files that exist', () => {
    const appPaths = new Set(['/', '/#about'])
    for (const [file, html] of site.files) {
      for (const [, href] of html.matchAll(/href="(\/[^"]*)"/g)) {
        const exists = paths.has(href) || appPaths.has(href) || existsSync(join(PUBLIC_DIR, href))
        expect(exists, `${file} links to ${href}`).toBe(true)
      }
    }
  })

  it('lists every page in the sitemap', () => {
    const sitemap = site.files.get('sitemap.xml')!

    for (const path of ['/', ...paths, '/agents.md', '/llms.txt']) {
      expect(sitemap).toContain(`<loc>https://cgtvisualiser.co.uk${path}</loc>`)
    }
  })
})
