import { describe, it, expect } from 'vitest'
import { helpContent } from '../helpContent'
import { buildGuideSite } from '../../guides'

describe('helpContent', () => {
  it('links only to guide pages that exist', () => {
    const paths = new Set(buildGuideSite().pages.map(p => p.path))
    const internal = Object.values(helpContent).flatMap(c => c.references.map(r => r.url)).filter(url => url.startsWith('/'))

    expect(internal.length).toBeGreaterThan(0)
    for (const url of internal) expect(paths, url).toContain(url)
  })
})
