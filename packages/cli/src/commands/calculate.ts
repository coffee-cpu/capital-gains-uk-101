import { importCSVText } from '../../../../src/lib/import'
import { runPipeline } from '../../../../src/lib/pipeline'
import { JsDelivrSplitSource } from '../../../../src/lib/splits/splitDataSource'
import { FXSource } from '../../../../src/types/fxSource'
import { GenericTransaction } from '../../../../src/types/transaction'
import { InputFile } from '../inputs'
import { CliError, ExitCode } from '../meta'
import { buildCalculateReport, CalculateReport, ReportInput, ReportWarning } from '../report'

export interface CalculateOptions {
  taxYear: string | null
  fxSource: FXSource
  autoSplits: boolean
  offline: boolean
  details: boolean
}

/**
 * Import every file, run the shared pipeline (same code as the web app) and
 * build the JSON report.
 */
export async function calculate(files: InputFile[], options: CalculateOptions): Promise<CalculateReport> {
  const inputs: ReportInput[] = []
  const warnings: ReportWarning[] = []
  const transactions: GenericTransaction[] = []
  const seenFileIds = new Set<string>()

  for (const file of files) {
    // Same rule as the web app: a file with the same name and size is imported once
    if (seenFileIds.has(file.fileId)) {
      warnings.push({
        code: 'DUPLICATE_FILE',
        message: `"${file.path}" has the same name and size as an earlier input and was skipped.`,
      })
      continue
    }
    seenFileIds.add(file.fileId)

    let imported
    try {
      imported = importCSVText(file.text, file.fileId)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new CliError(`"${file.path}": ${reason} Run \`cgt-visualiser brokers\` to see supported formats.`, ExitCode.INPUT)
    }
    inputs.push({ file: file.path, broker: imported.broker, transactions: imported.transactions.length })
    transactions.push(...imported.transactions)
  }

  const splitSource = new JsDelivrSplitSource()
  const result = await runPipeline(transactions, {
    fxSource: options.fxSource,
    autoSplits: options.autoSplits,
    splitSource,
  })

  // Missing split data can't be detected from the result: report it explicitly
  if (splitSource.unavailableYears.size > 0) {
    const years = [...splitSource.unavailableYears].sort((a, b) => a - b)
    warnings.push({
      code: 'SPLIT_DATA_UNAVAILABLE',
      message:
        `Stock split data for ${years.join(', ')} could not be fetched and was not cached` +
        `${options.offline ? ' (--offline)' : ''}. Splits not recorded in your broker files ` +
        'were not applied, so quantities and costs for any share that split may be wrong. ' +
        'Run once online to cache the data, or add STOCK_SPLIT rows yourself.',
    })
  }

  return buildCalculateReport(result, { ...options, inputs, warnings })
}
