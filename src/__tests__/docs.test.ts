import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { GenericTransactionSchema } from '../types/transaction'
import { getEnabledBrokerDefinitions } from '../config/brokers'

/**
 * Checks that hand-written docs keep up with the code they describe: the
 * transaction schema in the specification, the broker list, and the CLI flags.
 */

const root = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('docs/SPECIFICATION.md', () => {
  const SPEC = 'docs/SPECIFICATION.md'
  const START = '<!-- generic-transaction-schema:start -->'
  const END = '<!-- generic-transaction-schema:end -->'

  it('has the GenericTransaction JSON Schema generated from src/types/transaction.ts', () => {
    const spec = read(SPEC)
    const start = spec.indexOf(START)
    const end = spec.indexOf(END)
    expect(start, `${SPEC} is missing the ${START} marker`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)

    const schema = JSON.stringify(z.toJSONSchema(GenericTransactionSchema), null, 2)
    const block = `${START}\n\`\`\`json\n${schema}\n\`\`\`\n`
    const current = spec.slice(start, end)

    if (process.env.UPDATE_SPEC) {
      writeFileSync(resolve(root, SPEC), spec.slice(0, start) + block + spec.slice(end))
      return
    }
    expect(
      current,
      `${SPEC} is out of date. Regenerate it with: UPDATE_SPEC=1 npx vitest run src/__tests__/docs.test.ts`
    ).toBe(block)
  })
})

describe('broker lists', () => {
  // Docs list Equity Awards under Charles Schwab
  const docName = (displayName: string) => displayName.replace(/^Charles Schwab (?=.)/, '')

  // Listed by hand in these files, so a new broker has to be added to each
  for (const path of ['README.md', 'packages/cli/README.md', 'public/llms.txt']) {
    it(`${path} names every supported broker`, () => {
      const text = read(path)
      const missing = getEnabledBrokerDefinitions()
        .map(broker => docName(broker.displayName))
        .filter(name => !text.includes(name))
      expect(missing, `Add these brokers to ${path}`).toEqual([])
    })
  }
})

describe('packages/cli/README.md', () => {
  it('documents every option in the CLI help', () => {
    const help = read('packages/cli/src/cli.ts').match(/const HELP = `([\s\S]*?)`\n/)?.[1]
    expect(help).toBeDefined()
    const flags = [...new Set(help!.match(/--[a-z][a-z-]+/g))]
    const readme = read('packages/cli/README.md')
    const missing = flags.filter(flag => !readme.includes(flag))
    expect(missing, 'Document these options in packages/cli/README.md').toEqual([])
  })
})

describe('docs/HMRC_RULES_CHECK.md', () => {
  it("records the latest check on HMRC_RULES_CHECK_DATE, the date the app shows", async () => {
    const { HMRC_RULES_CHECK_DATE } = await import('../lib/cgt/hmrcRulesCheck')
    const checks = read('docs/HMRC_RULES_CHECK.md').split('## Checks')[1] ?? ''
    const latest = checks.match(/^### (\d{4}-\d{2}-\d{2})$/m)?.[1]
    expect(latest, 'docs/HMRC_RULES_CHECK.md has no "### YYYY-MM-DD" check under "## Checks"').toBeDefined()
    expect(latest, 'Record the check in docs/HMRC_RULES_CHECK.md when changing HMRC_RULES_CHECK_DATE').toBe(HMRC_RULES_CHECK_DATE)
  })
})
