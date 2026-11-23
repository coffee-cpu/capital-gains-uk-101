import type { DataNotices, DisposalRecord, ImportOverlap, SplitConflict } from '../types/cgt'
import type { EnrichedTransaction, GenericTransaction } from '../types/transaction'

/**
 * Problems with the imported data that change, or may change, the figures.
 *
 * One list for the web app's Issues panel and the CLI's warnings, so both
 * detect the same things. Each issue carries the affected data rather than
 * text: the web app and the CLI word them for their own users (buttons and
 * settings versus command-line flags).
 */

export type DataIssueSeverity = 'error' | 'warning' | 'info'

/** What would supply a missing split ratio, depending on how split data was looked up */
export type MissingRatioRemedy =
  /** Community split data wasn't looked up (auto-splits off): turning it on may find the ratio */
  | 'enable-auto-splits'
  /** Community split data couldn't be downloaded: trying again may find the ratio */
  | 'retry-split-data'
  /** Community split data doesn't have it: the user has to add the ratio */
  | 'add-split-row'

export type DataIssue =
  | {
      /** Transactions with no GBP exchange rate, so their GBP values are missing */
      code: 'FX_RATE_MISSING'
      severity: 'error'
      transactions: EnrichedTransaction[]
    }
  | {
      /** Disposals that sell more than the imported history shows was acquired */
      code: 'INCOMPLETE_DISPOSAL'
      severity: 'error'
      disposals: DisposalRecord[]
    }
  | {
      /** Rows found in more than one file from the same broker, counted once */
      code: 'OVERLAPPING_ROWS_REMOVED'
      severity: 'info'
      rows: GenericTransaction[]
      overlaps: ImportOverlap[]
    }
  | {
      /** Split records for one split that disagree on the ratio */
      code: 'SPLIT_RATIO_CONFLICT'
      severity: 'warning'
      conflicts: SplitConflict[]
    }
  | {
      /** Stock split rows with no ratio that nothing else covers, so they weren't applied */
      code: 'SPLIT_WITHOUT_RATIO'
      severity: 'warning'
      splits: NonNullable<DataNotices['splitsWithoutRatio']>
      remedy: MissingRatioRemedy
    }
  | {
      /** Fetched split data that failed validation and wasn't applied */
      code: 'SPLIT_DATA_REJECTED'
      severity: 'warning'
      records: NonNullable<DataNotices['rejectedSplitRecords']>
    }
  | {
      /** Tickers for one ISIN given one symbol, so they share a Section 104 pool */
      code: 'SYMBOLS_MATCHED_BY_ISIN'
      severity: 'info'
      merges: NonNullable<DataNotices['symbolMerges']>
    }
  | {
      /** Tickers seen with more than one ISIN */
      code: 'TICKER_ISIN_CONFLICT'
      severity: 'warning'
      conflicts: NonNullable<DataNotices['tickerConflicts']>
    }
  | {
      /** Transactions of a type the importer didn't recognise, left out of the calculation */
      code: 'UNKNOWN_TRANSACTION_TYPE'
      severity: 'warning'
      transactions: EnrichedTransaction[]
    }

export type DataIssueCode = DataIssue['code']

/** The issue with the given code, narrowed to its fields */
export type DataIssueOf<C extends DataIssueCode> = Extract<DataIssue, { code: C }>

export interface DataIssueInput {
  /** The calculated transactions */
  transactions: EnrichedTransaction[]
  /** The disposals to check (the CLI passes only the tax years it reports) */
  disposals: DisposalRecord[]
  dataNotices?: DataNotices
}

/**
 * The data issues in a calculation, in a fixed order (the order both the
 * Issues panel and the CLI list them in). Kinds with nothing to report are
 * left out.
 */
export function findDataIssues({ transactions, disposals, dataNotices }: DataIssueInput): DataIssue[] {
  const issues: DataIssue[] = []

  const fxFailures = transactions.filter(tx => tx.fx_error)
  if (fxFailures.length > 0) {
    issues.push({ code: 'FX_RATE_MISSING', severity: 'error', transactions: fxFailures })
  }

  const incomplete = disposals.filter(d => d.isIncomplete)
  if (incomplete.length > 0) {
    issues.push({ code: 'INCOMPLETE_DISPOSAL', severity: 'error', disposals: incomplete })
  }

  const overlappingRows = dataNotices?.overlappingRows ?? []
  if (overlappingRows.length > 0) {
    issues.push({
      code: 'OVERLAPPING_ROWS_REMOVED',
      severity: 'info',
      rows: overlappingRows,
      overlaps: dataNotices?.importOverlaps ?? [],
    })
  }

  const splitConflicts = dataNotices?.splitConflicts ?? []
  if (splitConflicts.length > 0) {
    issues.push({ code: 'SPLIT_RATIO_CONFLICT', severity: 'warning', conflicts: splitConflicts })
  }

  const splitsWithoutRatio = dataNotices?.splitsWithoutRatio ?? []
  if (splitsWithoutRatio.length > 0) {
    issues.push({
      code: 'SPLIT_WITHOUT_RATIO',
      severity: 'warning',
      splits: splitsWithoutRatio,
      remedy: dataNotices?.autoSplits === false
        ? 'enable-auto-splits'
        : dataNotices?.splitDataUnavailable ? 'retry-split-data' : 'add-split-row',
    })
  }

  const rejectedSplits = dataNotices?.rejectedSplitRecords ?? []
  if (rejectedSplits.length > 0) {
    issues.push({ code: 'SPLIT_DATA_REJECTED', severity: 'warning', records: rejectedSplits })
  }

  const symbolMerges = dataNotices?.symbolMerges ?? []
  if (symbolMerges.length > 0) {
    issues.push({ code: 'SYMBOLS_MATCHED_BY_ISIN', severity: 'info', merges: symbolMerges })
  }

  const tickerConflicts = dataNotices?.tickerConflicts ?? []
  if (tickerConflicts.length > 0) {
    issues.push({ code: 'TICKER_ISIN_CONFLICT', severity: 'warning', conflicts: tickerConflicts })
  }

  const unknown = transactions.filter(tx => tx.type === 'UNKNOWN')
  if (unknown.length > 0) {
    issues.push({ code: 'UNKNOWN_TRANSACTION_TYPE', severity: 'warning', transactions: unknown })
  }

  return issues
}
