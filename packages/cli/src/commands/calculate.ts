import { importCSVText } from '../../../../src/lib/import'
import { runPipeline } from '../../../../src/lib/pipeline'
import { CGTCalculationResult } from '../../../../src/types/cgt'
import { FXSource } from '../../../../src/types/fxSource'
import { GenericTransaction } from '../../../../src/types/transaction'
import { SkippedRow } from '../../../../src/types/brokerDefinition'
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
  return (await calculateWithResult(files, options)).report
}

/** Like `calculate`, but also returns the engine's raw result (used for the PDF report) */
export async function calculateWithResult(
  files: InputFile[],
  options: CalculateOptions
): Promise<{ report: CalculateReport; result: CGTCalculationResult | null }> {
  const inputs: ReportInput[] = []
  const warnings: ReportWarning[] = []
  const skippedRows: { file: string; rows: SkippedRow[] }[] = []
  const transactions: GenericTransaction[] = []
  const fileNames = new Map<string, string>()

  for (const file of files) {
    // Same rule as the web app: a file with the same name and size is imported once
    if (fileNames.has(file.fileId)) {
      warnings.push({
        code: 'DUPLICATE_FILE',
        message: `"${file.path}" has the same name and size as an earlier input and was skipped.`,
      })
      continue
    }
    fileNames.set(file.fileId, file.path)

    let imported
    try {
      imported = importCSVText(file.text, file.fileId)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new CliError(`"${file.path}": ${reason} Run \`cgt-visualiser brokers\` to see supported formats.`, ExitCode.INPUT)
    }
    inputs.push({ file: file.path, broker: imported.broker, transactions: imported.transactions.length })
    transactions.push(...imported.transactions)
    skippedRows.push({ file: file.path, rows: imported.skippedRows })
  }

  const result = await runPipeline(transactions, {
    fxSource: options.fxSource,
    autoSplits: options.autoSplits,
  })

  return { report: buildCalculateReport(result, { ...options, inputs, warnings, skippedRows, fileNames }), result }
}
