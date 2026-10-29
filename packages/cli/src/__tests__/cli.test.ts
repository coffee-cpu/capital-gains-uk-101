// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { main, CliIO } from '../cli'
import { calculate } from '../commands/calculate'
import { normalize } from '../commands/normalize'
import { CliError } from '../meta'
import { readInputFiles } from '../inputs'
import { money, CalculateReport } from '../report'
import { createFileCacheBackends } from '../fileCache'
import { importCSVText, createFileId } from '../../../../src/lib/import'
import { runPipeline } from '../../../../src/lib/pipeline'
import {
  createMemoryCacheBackends,
  setCacheBackends,
  FXRate,
  RecordCache,
} from '../../../../src/lib/cache'
import { getEnabledBrokerDefinitions } from '../../../../src/config/brokers'

const REPO_ROOT = join(__dirname, '../../../..')
const FIXTURES = join(REPO_ROOT, 'e2e/fixtures')
const fixture = (name: string) => join(FIXTURES, name)

/** FX cache that answers every lookup with the same rate, so no network is needed */
class ConstantRateCache implements RecordCache<string, FXRate> {
  async get(key: string): Promise<FXRate> {
    return { id: key, date: '', currency: '', rate: 1.25, source: 'test' }
  }
  async put(): Promise<void> {}
  async bulkPut(): Promise<void> {}
}

function useConstantRates() {
  setCacheBackends({ ...createMemoryCacheBackends(), fxRates: new ConstantRateCache() })
}

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

async function run(args: string[], isTTY = false): Promise<RunResult> {
  let stdout = ''
  let stderr = ''
  const io: CliIO = {
    stdout: text => { stdout += text },
    stderr: text => { stderr += text },
    isTTY,
  }
  const code = await main(args, io)
  return { code, stdout, stderr }
}

const OFFLINE = ['--no-auto-splits', '--no-cache', '--offline']

describe('cgt-visualiser CLI', () => {
  let fetchSpy: ReturnType<typeof vi.fn>
  let tmp: string

  beforeEach(() => {
    // Fail loudly if anything tries to reach the network
    fetchSpy = vi.fn(() => Promise.reject(new Error('network not allowed in tests')))
    vi.stubGlobal('fetch', fetchSpy)
    tmp = mkdtempSync(join(tmpdir(), 'cgt-cli-'))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setCacheBackends(createMemoryCacheBackends())
    rmSync(tmp, { recursive: true, force: true })
  })

  describe('calculate', () => {
    it('reproduces HMRC HS284 example 3 (net gain £629.67 in 2024/25)', async () => {
      const { code, stdout } = await run(['calculate', fixture('hmrc-hs284-example3.csv'), '--tax-year', '2024/25', ...OFFLINE])
      const report: CalculateReport = JSON.parse(stdout)

      expect(code).toBe(0)
      expect(report.schemaVersion).toBe(1)
      expect(report.taxYears).toHaveLength(1)
      expect(report.taxYears[0]).toMatchObject({
        taxYear: '2024/25',
        disposals: 2,
        netGainOrLossGbp: 629.67,
        sa108: { numberOfDisposals: 2, gainsBeforeLossesGbp: 629.67, lossesGbp: 0 },
      })
      expect(report.taxYears[0].rateChange2024).toBeDefined()
      expect(report.disposals.every(d => d.rules.includes('section-104'))).toBe(true)
      expect(report.warnings).toEqual([])
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('reports 30-day and pool matches with --details (HS284 example 2)', async () => {
      const { stdout } = await run(['calculate', fixture('hmrc-hs284-example2.csv'), '--tax-year', '2025/26', '--details', ...OFFLINE])
      const report: CalculateReport = JSON.parse(stdout)
      const disposal = report.disposals.find(d => d.symbol === 'MESOPOTAMIA' && d.date === '2025-08-30')!

      expect(report.taxYears[0].netGainOrLossGbp).toBe(1650)
      expect(disposal.rules).toEqual(expect.arrayContaining(['30-day', 'section-104']))
      const thirtyDay = disposal.details!.matches.find(m => m.rule === '30-day')!
      expect(thirtyDay.acquisitions).toEqual([
        expect.objectContaining({ date: '2025-09-11', quantity: 500, costGbp: 850 }),
      ])
      expect(disposal.details!.matches.find(m => m.rule === 'section-104')).toMatchObject({ quantity: 3500 })
      expect(disposal.details!.section104Pool!.before.quantity - disposal.details!.section104Pool!.after.quantity).toBe(3500)
    })

    it('omits details unless --details is passed', async () => {
      const { stdout } = await run(['calculate', fixture('hmrc-hs284-example3.csv'), ...OFFLINE])
      const report: CalculateReport = JSON.parse(stdout)

      expect(report.disposals.length).toBeGreaterThan(0)
      expect(report.disposals.every(d => d.details === undefined)).toBe(true)
    })

    it('defaults to text in a terminal and supports csv', async () => {
      const text = await run(['calculate', fixture('hmrc-hs284-example3.csv'), ...OFFLINE], true)
      const csv = await run(['calculate', fixture('hmrc-hs284-example3.csv'), '--format', 'csv', ...OFFLINE])

      expect(text.stdout).toContain('Tax year 2024/25')
      expect(text.stdout).toContain('£629.67')
      expect(text.stdout).toContain('Not tax advice')
      expect(csv.stdout.split('\n')[0]).toBe('date,tax_year,symbol,quantity,proceeds_gbp,allowable_costs_gbp,gain_or_loss_gbp,rules,incomplete,transaction_id')
      expect(csv.stdout.trim().split('\n')).toHaveLength(3)
    })

    it('writes the same PDF report as the web app with --format pdf', async () => {
      const out = join(tmp, 'report.pdf')
      const args = ['calculate', fixture('hmrc-hs284-example3.csv'), '--tax-year', '2024/25', '--format', 'pdf', ...OFFLINE]

      const { code, stdout, stderr } = await run([...args, '-o', out])
      const pdf = readFileSync(out)

      expect(code).toBe(0)
      expect(stdout).toBe('')
      expect(stderr).toContain(`Wrote the 2024/25 report to ${out}`)
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
      expect(pdf.length).toBeGreaterThan(2000)

      const withTransactions = join(tmp, 'with-transactions.pdf')
      await run([...args, '-o', withTransactions, '--include-transactions'])
      expect(readFileSync(withTransactions).length).toBeGreaterThan(pdf.length)
    })

    it('needs --tax-year and -o for --format pdf, and names the years with data', async () => {
      const file = fixture('hmrc-hs284-example3.csv')

      const missing = await run(['calculate', file, '--format', 'pdf', '-o', join(tmp, 'r.pdf'), ...OFFLINE])
      expect(missing.code).toBe(1)
      expect(missing.stderr).toContain('--format pdf needs --tax-year')

      const noData = await run(['calculate', file, '--format', 'pdf', '--tax-year', '2010/11', '-o', join(tmp, 'r.pdf'), ...OFFLINE])
      expect(noData.code).toBe(1)
      expect(noData.stderr).toContain('Tax years with data: 2016/17, 2019/20, 2024/25')
    })

    it('warns about incomplete disposals and exits 3 with --strict', async () => {
      const file = join(tmp, 'sell-only.csv')
      writeFileSync(file, 'date,type,symbol,currency,quantity,price,total,fee\n2024-06-03,SELL,VOD,GBP,100,0.70,70,0\n')

      const lenient = await run(['calculate', file, ...OFFLINE])
      const strict = await run(['calculate', file, '--strict', ...OFFLINE])
      const report: CalculateReport = JSON.parse(lenient.stdout)

      expect(lenient.code).toBe(0)
      expect(strict.code).toBe(3)
      expect(report.disposals[0].incomplete).toBe(true)
      expect(report.warnings.map(w => w.code)).toContain('INCOMPLETE_DISPOSAL')
    })

    it('reports missing FX rates instead of failing when offline', async () => {
      const { code, stdout } = await run(['calculate', fixture('schwab-sample.csv'), ...OFFLINE])
      const report: CalculateReport = JSON.parse(stdout)
      const fxWarning = report.warnings.find(w => w.code === 'FX_RATE_MISSING')!

      expect(code).toBe(0)
      expect(fxWarning.message).toContain('USD')
      expect(fxWarning.transactionIds!.length).toBeGreaterThan(0)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('skips a file passed twice, as the web app does', async () => {
      const { stdout } = await run(['calculate', fixture('hmrc-hs284-example3.csv'), fixture('hmrc-hs284-example3.csv'), ...OFFLINE])
      const report: CalculateReport = JSON.parse(stdout)

      expect(report.inputs).toHaveLength(1)
      expect(report.warnings.map(w => w.code)).toContain('DUPLICATE_FILE')
      expect(report.taxYears.find(y => y.taxYear === '2024/25')!.netGainOrLossGbp).toBe(629.67)
    })

    it('warns when stock split data is unavailable, and exits 3 with --strict', async () => {
      const args = ['calculate', fixture('hmrc-hs284-example3.csv'), '--offline', '--no-cache']

      const { code, stdout } = await run(args)
      const strict = await run([...args, '--strict'])
      const warning = (JSON.parse(stdout) as CalculateReport).warnings.find(w => w.code === 'SPLIT_DATA_UNAVAILABLE')

      expect(code).toBe(0)
      expect(strict.code).toBe(3)
      expect(warning!.message).toContain('2016')
      expect(warning!.message).toContain('--offline')
    })

    it('warns about rows it could not read, and exits 3 with --strict', async () => {
      const file = join(tmp, 'typo.csv')
      writeFileSync(file, 'date,type,symbol,currency,quantity,price,total,fee\n2024-01-02,BUY,VOD,GBP,100,1,100,0\n2024-06-03,SEL,VOD,GBP,100,2,200,0\n')

      const { code, stdout } = await run(['calculate', file, ...OFFLINE])
      const strict = await run(['calculate', file, '--strict', ...OFFLINE])
      const warning = (JSON.parse(stdout) as CalculateReport).warnings.find(w => w.code === 'SKIPPED_ROWS')

      expect(code).toBe(0)
      expect(strict.code).toBe(3)
      expect(warning!.message).toContain('row 3: unrecognised type "SEL"')
    })

    it('warns when the requested tax year has no transactions', async () => {
      const { stdout } = await run(['calculate', fixture('hmrc-hs284-example3.csv'), '--tax-year', '2010/11', ...OFFLINE])
      const report: CalculateReport = JSON.parse(stdout)

      expect(report.taxYears).toEqual([])
      expect(report.warnings.map(w => w.code)).toEqual(['TAX_YEAR_NOT_FOUND'])
    })
  })

  describe('parity with the web app pipeline', () => {
    // Every fixture, with a fixed FX rate so USD files need no network
    const fixtures = readdirSync(FIXTURES).filter(f => f.endsWith('.csv'))

    it.each(fixtures)('%s gives the same totals as runPipeline', async name => {
      useConstantRates()
      const [file] = await readInputFiles([fixture(name)])
      const options = { taxYear: null, fxSource: 'HMRC_MONTHLY' as const, autoSplits: false, offline: true, details: false }

      const report = await calculate([file], options)
      const { transactions } = importCSVText(file.text, file.fileId)
      const expected = await runPipeline(transactions, { autoSplits: false })

      expect(report.taxYears.map(y => [y.taxYear, y.disposals, y.proceedsGbp, y.allowableCostsGbp, y.netGainOrLossGbp, y.taxableGainGbp]))
        .toEqual([...expected!.taxYearSummaries]
          .sort((a, b) => a.startDate.localeCompare(b.startDate))
          .map(s => [s.taxYear, s.totalDisposals, money(s.totalProceedsGbp), money(s.totalAllowableCostsGbp), money(s.netGainOrLossGbp), money(s.taxableGainGbp)]))
      expect(report.disposals.map(d => d.id).sort()).toEqual(expected!.disposals.map(d => d.disposal.id).sort())
    })

    it('uses the same transaction IDs as the web app', async () => {
      const [file] = await readInputFiles([fixture('hmrc-hs284-example3.csv')])
      const size = readFileSync(fixture('hmrc-hs284-example3.csv')).byteLength

      expect(file.fileId).toBe(createFileId('hmrc-hs284-example3.csv', size))
    })
  })

  describe('normalize', () => {
    const cgtTotals = (report: CalculateReport) =>
      report.taxYears.map(y => [y.taxYear, y.disposals, y.proceedsGbp, y.allowableCostsGbp, y.gainsGbp, y.lossesGbp, y.netGainOrLossGbp])
    const options = { taxYear: null, fxSource: 'HMRC_MONTHLY' as const, autoSplits: false, offline: true, details: false }

    // normalize → calculate must give the same gains as calculate on the originals,
    // or normalize must refuse to write a file
    it.each(readdirSync(FIXTURES).filter(f => f.endsWith('.csv')))('%s round-trips or is refused', async name => {
      useConstantRates()
      const files = await readInputFiles([fixture(name)])
      const original = await calculate(files, options)

      let csv: string
      try {
        csv = normalize(files).csv
      } catch (error) {
        expect(error).toBeInstanceOf(CliError)
        expect((error as CliError).message).toContain('options or short sells')
        const { transactions } = importCSVText(files[0].text, files[0].fileId)
        expect(transactions.some(tx => tx.is_short_sell || tx.option_type)).toBe(true)
        return
      }
      const roundTrip = await calculate([{ path: 'generic.csv', name: 'generic.csv', text: csv, fileId: 'generic' }], options)

      expect(cgtTotals(roundTrip)).toEqual(cgtTotals(original))
    })

    it('keeps broker stock split ratios', () => {
      const csv = [
        'date,type,symbol,currency,quantity,price,total,fee,split_ratio',
        '2024-01-02,BUY,NVDA,USD,10,500,5000,0,',
        '2024-06-10,STOCK_SPLIT,NVDA,USD,,,,,10:1',
      ].join('\n')

      const { csv: out } = normalize([{ path: 'in.csv', name: 'in.csv', text: csv, fileId: 'in' }])

      expect(out.split('\n')[0]).toContain('split_ratio')
      expect(out).toMatch(/STOCK_SPLIT,NVDA,.*,10:1/)
    })

    it('skips a file passed twice', async () => {
      const out = join(tmp, 'generic.csv')

      const { stderr } = await run(['normalize', fixture('hmrc-hs284-example3.csv'), fixture('hmrc-hs284-example3.csv'), '-o', out])

      expect(stderr).toContain('Skipped')
      expect(readFileSync(out, 'utf-8').trim().split('\n')).toHaveLength(5)
    })

    it('writes a Generic CSV that calculates to the same result', async () => {
      const out = join(tmp, 'generic.csv')

      const normalized = await run(['normalize', fixture('hmrc-hs284-example3.csv'), '-o', out])
      const original = JSON.parse((await run(['calculate', fixture('hmrc-hs284-example3.csv'), ...OFFLINE])).stdout)
      const roundTrip = JSON.parse((await run(['calculate', out, ...OFFLINE])).stdout)

      expect(normalized.code).toBe(0)
      expect(roundTrip.inputs[0].broker).toBe('Generic CSV')
      expect(roundTrip.taxYears).toEqual(original.taxYears)
    })

    it('warns on stderr about rows it could not read', async () => {
      const file = join(tmp, 'typo.csv')
      const out = join(tmp, 'generic.csv')
      writeFileSync(file, 'date,type,symbol,currency,quantity,price,total,fee\n2024-01-02,BUY,VOD,GBP,100,1,100,0\n2024-06-03,SEL,VOD,GBP,100,2,200,0\n')

      const { code, stderr } = await run(['normalize', file, '-o', out])

      expect(code).toBe(0)
      expect(stderr).toContain('Warning:')
      expect(stderr).toContain('row 3: unrecognised type "SEL"')
    })

    it('requires an output file', async () => {
      const { code, stderr } = await run(['normalize', fixture('hmrc-hs284-example3.csv')])

      expect(code).toBe(1)
      expect(stderr).toContain('-o <file>')
    })
  })

  describe('detect and brokers', () => {
    it('detects broker formats and exits 2 for unrecognised files', async () => {
      const unknown = join(tmp, 'unknown.csv')
      writeFileSync(unknown, 'foo,bar\n1,2\n')

      const { code, stdout } = await run(['detect', fixture('schwab-sample.csv'), unknown])
      const results = JSON.parse(stdout)

      expect(code).toBe(2)
      expect(results[0]).toMatchObject({ recognised: true, broker: 'Charles Schwab', transactions: 10, skippedRows: [] })
      expect(results[1]).toMatchObject({ recognised: false, broker: 'Unknown' })
    })

    it('lists rows a file had to skip', async () => {
      const file = join(tmp, 'typo.csv')
      writeFileSync(file, 'date,type,symbol,currency,quantity,price,total,fee\n2024-01-02,BUY,VOD,GBP,100,1,100,0\n2024-06-03,SEL,VOD,GBP,100,2,200,0\n')

      const { code, stdout } = await run(['detect', file])

      expect(code).toBe(0)
      expect(JSON.parse(stdout)[0]).toMatchObject({
        transactions: 1,
        skippedRows: [{ row: 3, reason: 'unrecognised type "SEL"' }],
      })
    })

    it('lists every enabled broker with its export instructions', async () => {
      const { code, stdout } = await run(['brokers', '--format', 'json'])
      const brokers = JSON.parse(stdout)
      const schwab = brokers.find((b: { id: string }) => b.id === 'schwab')

      expect(code).toBe(0)
      expect(brokers.map((b: { name: string }) => b.name)).toEqual(getEnabledBrokerDefinitions().map(d => d.displayName))
      expect(schwab.exportSteps.length).toBeGreaterThan(0)
      expect(schwab.exampleFile).toBe('https://cgtvisualiser.co.uk/examples/schwab-transactions-example.csv')
    })
  })

  describe('usage', () => {
    it('prints help and version', async () => {
      expect((await run(['--help'])).stdout).toContain('Usage:')
      expect((await run([])).stdout).toContain('Usage:')
      expect((await run(['--version'])).stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
    })

    it.each([
      [['frobnicate'], 'Unknown command'],
      [['calculate', '--bogus'], 'Unknown option'],
      [['calculate', 'x.csv', '--tax-year', '2025/27'], 'Invalid --tax-year'],
      [['calculate', 'x.csv', '--fx', 'yahoo'], 'Unknown --fx'],
      [['calculate', 'x.csv', '--format', 'xml'], 'Unsupported --format'],
      [['calculate'], 'No input files'],
    ])('exits 1 for %j', async (args, message) => {
      const { code, stderr } = await run(args)

      expect(code).toBe(1)
      expect(stderr).toContain(message)
    })

    it('exits 2 when a file cannot be read or recognised', async () => {
      const unknown = join(tmp, 'unknown.csv')
      writeFileSync(unknown, 'foo,bar\n1,2\n')

      expect((await run(['calculate', join(tmp, 'missing.csv')])).code).toBe(2)
      expect((await run(['calculate', unknown, ...OFFLINE])).code).toBe(2)
    })

    it('keeps the engine\'s console logging off stdout', async () => {
      const log = vi.spyOn(process.stdout, 'write')
      await run(['calculate', fixture('schwab-sample.csv'), ...OFFLINE])

      expect(log).not.toHaveBeenCalled()
      log.mockRestore()
    })
  })
})

describe('JsonFileRecordCache', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'cgt-cache-')) })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('persists records across instances once flushed', async () => {
    const first = createFileCacheBackends(dir)
    await first.fxRates.bulkPut([{ id: 'HMRC_MONTHLY-2025-05-USD', date: '2025-05', currency: 'USD', rate: 1.33, source: 'test' }])
    await first.splitData.put({ year: 2024, data: '{}', fetchedAt: '2026-01-01T00:00:00Z' })
    await first.flush()

    const second = createFileCacheBackends(dir)

    expect(await second.fxRates.get('HMRC_MONTHLY-2025-05-USD')).toMatchObject({ rate: 1.33 })
    expect(await second.splitData.get(2024)).toMatchObject({ data: '{}' })
  })

  it('treats a corrupt cache file as empty', async () => {
    writeFileSync(join(dir, 'fx-rates.json'), 'not json')

    expect(await createFileCacheBackends(dir).fxRates.get('anything')).toBeUndefined()
  })
})
