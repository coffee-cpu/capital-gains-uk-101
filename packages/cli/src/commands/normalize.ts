import { describeSkippedRows, importCSVText } from '../../../../src/lib/import'
import { transactionsToGenericCSV } from '../../../../src/utils/csvExport'
import { deduplicateTransactions } from '../../../../src/utils/deduplication'
import { GenericTransaction } from '../../../../src/types/transaction'
import { InputFile } from '../inputs'
import { CliError, ExitCode } from '../meta'

/** Fields the Generic CSV format can't hold; losing them changes the CGT result */
function hasFieldsGenericCSVCannotHold(tx: GenericTransaction): boolean {
  return Boolean(tx.is_short_sell || tx.option_type || tx.underlying_symbol || tx.contract_size)
}

/**
 * Convert broker exports to one Generic CSV, the same format as the web app's
 * "Export Generic CSV". Edit it to fix or add rows, then pass it to `calculate`.
 *
 * Applies the same import rules as `calculate` (duplicate files skipped, Schwab
 * Stock Plan Activity covered by Equity Awards removed, ignored rows dropped)
 * so the Generic CSV calculates to the same capital gains.
 */
export function normalize(files: InputFile[]): {
  csv: string
  transactions: number
  skippedFiles: string[]
  /** One message per file whose rows couldn't all be read */
  skippedRowMessages: string[]
} {
  const transactions: GenericTransaction[] = []
  const seenFileIds = new Set<string>()
  const skippedFiles: string[] = []
  const skippedRowMessages: string[] = []

  for (const file of files) {
    if (seenFileIds.has(file.fileId)) {
      skippedFiles.push(file.path)
      continue
    }
    seenFileIds.add(file.fileId)
    try {
      const imported = importCSVText(file.text, file.fileId)
      transactions.push(...imported.transactions)
      if (imported.skippedRows.length > 0) {
        skippedRowMessages.push(
          `"${file.path}": ${imported.skippedRows.length} row(s) could not be read and were left out ` +
          `(${describeSkippedRows(imported.skippedRows, 5)})`
        )
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new CliError(`"${file.path}": ${reason}`, ExitCode.INPUT)
    }
  }

  const unsupported = transactions.filter(hasFieldsGenericCSVCannotHold)
  if (unsupported.length > 0) {
    throw new CliError(
      `${unsupported.length} transaction(s) are options or short sells, which the Generic CSV format can't ` +
      `represent (e.g. ${unsupported[0].id} ${unsupported[0].symbol}). Converting them would change the ` +
      'calculated gains, so nothing was written. Pass the original broker files to `calculate` instead.',
      ExitCode.INPUT
    )
  }

  const kept = deduplicateTransactions(transactions).filter(tx => !tx.ignored)
  return { csv: transactionsToGenericCSV(kept) + '\n', transactions: kept.length, skippedFiles, skippedRowMessages }
}
