import { parseArgs } from 'node:util'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { realpathSync } from 'node:fs'
import { setCacheBackends, createMemoryCacheBackends } from '../../../src/lib/cache'
import { DEFAULT_FX_SOURCE, FXSource } from '../../../src/types/fxSource'
import { calculate } from './commands/calculate'
import { detect, formatDetectText } from './commands/detect'
import { listBrokers, formatBrokersText } from './commands/brokers'
import { normalize } from './commands/normalize'
import { createFileCacheBackends, defaultCacheDir, FileCacheBackends } from './fileCache'
import { formatCalculateText, formatDisposalsCsv } from './format'
import { readInputFiles } from './inputs'
import { CLI_NAME, CLI_VERSION, CliError, DISCLAIMER, ExitCode, ExitCodeValue, WEB_APP_URL } from './meta'

const FX_SOURCES: Record<string, FXSource> = {
  'hmrc-monthly': 'HMRC_MONTHLY',
  'hmrc-yearly': 'HMRC_YEARLY_AVG',
  'daily-spot': 'DAILY_SPOT',
}

const HELP = `${CLI_NAME} ${CLI_VERSION}
UK capital gains tax on shares, from your broker's CSV exports. Applies HMRC's
same-day, 30-day and Section 104 matching rules. Runs on your machine: your
transactions are never uploaded. Same engine as ${WEB_APP_URL}.

Usage:
  ${CLI_NAME} calculate <files...> [options]   Calculate gains and losses
  ${CLI_NAME} detect <files...>                Identify each file's broker format
  ${CLI_NAME} brokers                          List supported brokers and how to export
  ${CLI_NAME} normalize <files...> -o <out>    Convert exports to one editable Generic CSV

calculate options:
  --tax-year <YYYY/YY>  Only report this UK tax year, e.g. 2025/26 (default: all)
  --fx <source>         hmrc-monthly (default), hmrc-yearly or daily-spot
  --details             JSON: add each disposal's matches, FX rate and pool before/after
  --no-auto-splits      Don't fetch stock split data (broker-provided splits still apply)
  --offline             No network access: use cached exchange rates only
  --strict              Exit with code 3 if there are warnings

Common options:
  --format <fmt>        text, json (calculate also: csv). Default: text in a
                        terminal, json when output is piped
  --no-cache            Don't read or write the cache (${defaultCacheDir()})
  -o, --output <file>   Write output to a file instead of stdout
  --verbose             Show diagnostic logging on stderr
  -h, --help            Show this help
  -v, --version         Show the version

Exit codes: 0 success, 1 usage or unexpected error, 2 a file could not be read
or recognised, 3 warnings with --strict.

Network: only public reference data is fetched (HMRC/ECB exchange rates and
stock split data). No transaction data is sent anywhere.

${DISCLAIMER}
`

export interface CliIO {
  stdout: (text: string) => void
  stderr: (text: string) => void
  /** Whether stdout is a terminal (selects the default format) */
  isTTY: boolean
  env?: NodeJS.ProcessEnv
}

type Format = 'text' | 'json' | 'csv'

function parseFormat(value: string | undefined, isTTY: boolean, allowed: Format[]): Format {
  if (value === undefined) return isTTY ? 'text' : 'json'
  if (!allowed.includes(value as Format)) {
    throw new CliError(`Unsupported --format "${value}". Use one of: ${allowed.join(', ')}.`)
  }
  return value as Format
}

function parseTaxYear(value: string | undefined): string | null {
  if (value === undefined) return null
  const match = /^(\d{4})\/(\d{2})$/.exec(value)
  if (!match || (Number(match[1]) + 1) % 100 !== Number(match[2])) {
    throw new CliError(`Invalid --tax-year "${value}". Use the form 2025/26 (6 April 2025 to 5 April 2026).`)
  }
  return value
}

function parseFxSource(value: string | undefined): FXSource {
  if (value === undefined) return DEFAULT_FX_SOURCE
  const source = FX_SOURCES[value]
  if (!source) {
    throw new CliError(`Unknown --fx "${value}". Use one of: ${Object.keys(FX_SOURCES).join(', ')}.`)
  }
  return source
}

const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n'

/**
 * Silence the shared engine's console logging (it is written for the browser
 * devtools) so stdout stays clean for JSON; --verbose routes it to stderr.
 */
function routeConsole(verbose: boolean, stderr: (text: string) => void): () => void {
  const methods = ['log', 'info', 'debug', 'warn', 'error'] as const
  const original = methods.map(method => console[method])
  for (const method of methods) {
    console[method] = verbose
      ? (...args: unknown[]) => stderr(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n')
      : () => {}
  }
  return () => methods.forEach((method, i) => { console[method] = original[i] })
}

/** Run the CLI with the given arguments; returns the process exit code */
export async function main(argv: string[], io: CliIO): Promise<ExitCodeValue> {
  let restoreConsole: (() => void) | null = null
  const realFetch = globalThis.fetch
  let cache: FileCacheBackends | null = null

  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        'tax-year': { type: 'string' },
        fx: { type: 'string' },
        details: { type: 'boolean', default: false },
        'no-auto-splits': { type: 'boolean', default: false },
        offline: { type: 'boolean', default: false },
        strict: { type: 'boolean', default: false },
        format: { type: 'string' },
        'no-cache': { type: 'boolean', default: false },
        output: { type: 'string', short: 'o' },
        verbose: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    })

    if (values.version) {
      io.stdout(`${CLI_VERSION}\n`)
      return ExitCode.OK
    }
    const [command, ...paths] = positionals
    if (values.help || command === undefined || command === 'help') {
      io.stdout(HELP)
      return ExitCode.OK
    }

    restoreConsole = routeConsole(values.verbose, io.stderr)
    const isTTY = io.isTTY && values.output === undefined
    const emit = async (text: string) => {
      if (values.output === undefined) {
        io.stdout(text)
      } else {
        await writeFile(values.output, text)
      }
    }

    switch (command) {
      case 'calculate': {
        const options = {
          taxYear: parseTaxYear(values['tax-year']),
          fxSource: parseFxSource(values.fx),
          autoSplits: !values['no-auto-splits'],
          offline: values.offline,
          details: values.details,
        }
        const format = parseFormat(values.format, isTTY, ['text', 'json', 'csv'])
        const files = await readInputFiles(paths)

        if (values['no-cache']) {
          setCacheBackends(createMemoryCacheBackends())
        } else {
          cache = createFileCacheBackends(defaultCacheDir(io.env ?? process.env))
          setCacheBackends(cache)
        }
        if (options.offline) {
          globalThis.fetch = () => Promise.reject(new Error('network access is disabled (--offline)'))
        }

        const report = await calculate(files, options)
        await emit(
          format === 'json' ? json(report) : format === 'csv' ? formatDisposalsCsv(report) : formatCalculateText(report)
        )
        if (format === 'csv' && report.warnings.length > 0) {
          io.stderr(report.warnings.map(w => `warning [${w.code}]: ${w.message}\n`).join(''))
        }
        return values.strict && report.warnings.length > 0 ? ExitCode.WARNINGS : ExitCode.OK
      }

      case 'detect': {
        const format = parseFormat(values.format, isTTY, ['text', 'json'])
        const results = detect(await readInputFiles(paths))
        await emit(format === 'json' ? json(results) : formatDetectText(results))
        return results.every(r => r.recognised) ? ExitCode.OK : ExitCode.INPUT
      }

      case 'brokers': {
        const format = parseFormat(values.format, isTTY, ['text', 'json'])
        const brokers = listBrokers()
        await emit(format === 'json' ? json(brokers) : formatBrokersText(brokers))
        return ExitCode.OK
      }

      case 'normalize': {
        if (values.output === undefined) {
          throw new CliError('normalize needs -o <file> for the Generic CSV output.')
        }
        const { csv, transactions } = normalize(await readInputFiles(paths))
        await emit(csv)
        io.stderr(`Wrote ${transactions} transactions to ${values.output}\n`)
        return ExitCode.OK
      }

      default:
        throw new CliError(`Unknown command "${command}". Run \`${CLI_NAME} --help\`.`)
    }
  } catch (error) {
    if (error instanceof CliError) {
      io.stderr(`${CLI_NAME}: ${error.message}\n`)
      return error.exitCode
    }
    // parseArgs reports unknown or malformed options with a TypeError
    if (error instanceof TypeError && 'code' in error && String(error.code).startsWith('ERR_PARSE_ARGS')) {
      io.stderr(`${CLI_NAME}: ${error.message}. Run \`${CLI_NAME} --help\`.\n`)
      return ExitCode.USAGE
    }
    io.stderr(`${CLI_NAME}: unexpected error: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    return ExitCode.USAGE
  } finally {
    globalThis.fetch = realFetch
    restoreConsole?.()
    if (cache) {
      // The cache only saves repeat downloads; failing to write it is not an error
      await cache.flush().catch(() => {})
    }
  }
}

// Run when executed directly (not when imported by tests)
const entry = process.argv[1] ? realpathSync(process.argv[1]) : ''
if (entry === fileURLToPath(import.meta.url)) {
  const code = await main(process.argv.slice(2), {
    stdout: text => process.stdout.write(text),
    stderr: text => process.stderr.write(text),
    isTTY: Boolean(process.stdout.isTTY),
  })
  process.exitCode = code
}
