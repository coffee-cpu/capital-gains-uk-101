import { importCSVText } from '../../../../src/lib/import'
import { transactionsToGenericCSV } from '../../../../src/utils/csvExport'
import { GenericTransaction } from '../../../../src/types/transaction'
import { InputFile } from '../inputs'
import { CliError, ExitCode } from '../meta'

/**
 * Convert broker exports to one Generic CSV, the same format as the web app's
 * "Export Generic CSV". Edit it to fix or add rows, then pass it to `calculate`.
 */
export function normalize(files: InputFile[]): { csv: string; transactions: number } {
  const transactions: GenericTransaction[] = []
  for (const file of files) {
    try {
      transactions.push(...importCSVText(file.text, file.fileId).transactions)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new CliError(`"${file.path}": ${reason}`, ExitCode.INPUT)
    }
  }
  return { csv: transactionsToGenericCSV(transactions) + '\n', transactions: transactions.length }
}
