import type { CGTCalculationResult, DataNotices, DisposalRecord } from '../types/cgt'
import type { EnrichedTransaction } from '../types/transaction'
import type { SkippedRow } from '../types/brokerDefinition'
import { BrokerType } from '../types/broker'
import { describeSkippedRows } from './import'
import { groupBy } from './cgt/utils'
import type { SplitRejectionReason } from './splits/splitDataSource'

/**
 * Problems with the imported data that change, or may change, the figures.
 *
 * One list, with one wording, for the web app's Issues panel and the CLI's
 * warnings. Only the remedy differs: the panel points to its settings and
 * buttons, the CLI to its flags.
 */

export type DataIssueSeverity = 'error' | 'warning' | 'info'

export type DataIssueCode =
  | 'FX_RATE_MISSING'
  | 'INCOMPLETE_DISPOSAL'
  | 'SKIPPED_ROWS'
  | 'SPLIT_RATIO_CONFLICT'
  | 'SPLIT_WITHOUT_RATIO'
  | 'SPLIT_DATA_REJECTED'
  | 'SPLIT_DATA_UNAVAILABLE'
  | 'TICKER_ISIN_CONFLICT'
  | 'UNKNOWN_TRANSACTION_TYPE'
  | 'INCOMPLETE_STOCK_PLAN'
  | 'OVERLAPPING_ROWS_REMOVED'
  | 'SYMBOLS_MATCHED_BY_ISIN'
  | 'NO_DISPOSALS'

export interface DataIssue {
  code: DataIssueCode
  /** The Issues panel's key for this kind of issue */
  id: string
  severity: DataIssueSeverity
  title: string
  description: string
  /** Number of affected items */
  count?: number
  /** Affected symbols */
  affectedItems?: string[]
  transactionIds?: string[]
  /** One line per item worth listing, e.g. each pair of overlapping files */
  details?: string[]
  /** True when the web app's table highlights the affected rows (and "Needs attention" lists them) */
  flaggedInTable?: boolean
  /** What to do about it, in each channel's terms */
  remedy?: { web: string; cli: string }
}

export interface DataIssueInput {
  /** The calculated transactions */
  transactions: EnrichedTransaction[]
  /** The disposals to check (the CLI passes only the tax years it reports) */
  disposals: DisposalRecord[]
  dataNotices?: DataNotices
  metadata?: CGTCalculationResult['metadata']
  /** File names by file ID, to name files in notices (falls back to the ID) */
  fileNames?: ReadonlyMap<string, string>
  /** Rows each input file's parser left out (not kept after import, so only the CLI has them) */
  skippedRows?: { file: string; rows: SkippedRow[] }[]
}

/** Why fetched split data was rejected, in plain words */
const REJECTION_REASONS: Partial<Record<string, string>> = {
  'missing-symbol': 'no symbol',
  'invalid-date': 'not a valid date',
  'wrong-year': 'date outside the year it was published under',
  'future-date': 'date in the future',
  'invalid-ratio': 'ratio could not be read',
  'ratio-out-of-range': 'ratio too large or too small to be plausible',
} satisfies Record<SplitRejectionReason, string>

const SEVERITY_ORDER: Record<DataIssueSeverity, number> = { error: 0, warning: 1, info: 2 }

const s = (n: number) => (n !== 1 ? 's' : '')
const unique = (items: string[]) => [...new Set(items.filter(Boolean))]
const ADD_SPLIT_ROW_WEB = 'add a STOCK_SPLIT row with the ratio (e.g. 10:1) in a Generic CSV file.'
const ADD_SPLIT_ROW_CLI = 'add a STOCK_SPLIT row with the ratio (e.g. 10:1) in a Generic CSV.'

/**
 * The data issues in a calculation, errors first, then warnings, then
 * notices. Kinds with nothing to report are left out.
 */
export function findDataIssues(input: DataIssueInput): DataIssue[] {
  const { transactions, disposals, dataNotices: notices, metadata, fileNames = new Map(), skippedRows = [] } = input
  const issues: DataIssue[] = []

  const fxFailures = transactions.filter(tx => tx.fx_error)
  if (fxFailures.length > 0) {
    const crypto = fxFailures.some(tx => tx.fx_error?.includes('Crypto currency'))
    const one = fxFailures.length === 1
    issues.push({
      code: 'FX_RATE_MISSING',
      id: 'fx-rate-errors',
      flaggedInTable: true,
      severity: 'error',
      title: 'FX Rate Errors',
      description: `Failed to fetch exchange rates for ${fxFailures.length} transaction${s(fxFailures.length)}, so ` +
        (one ? 'its GBP value is missing and totals that include it are wrong.' : 'their GBP values are missing and totals that include them are wrong.') +
        (crypto ? ' Crypto currencies require manual GBP values.' : ''),
      count: fxFailures.length,
      affectedItems: unique(fxFailures.map(tx => tx.symbol)),
      transactionIds: fxFailures.map(tx => tx.id),
      details: [...groupBy(fxFailures, tx => tx.currency)].map(([currency, txs]) =>
        `${currency}: ${txs.length} transaction${s(txs.length)} (first error: ${txs[0].fx_error})`),
      remedy: crypto
        ? {
            web: 'Automatic FX conversion is not supported for crypto. For crypto-to-crypto trades, add a gbp_value column to your CSV with the GBP spot price of the quote currency at the time of each trade, then re-import.',
            cli: 'Automatic FX conversion is not supported for crypto. For crypto-to-crypto trades, add a gbp_value column to your CSV with the GBP spot price of the quote currency at the time of each trade.',
          }
        : {
            web: 'Try selecting a different FX source from the dropdown in the Transactions section.',
            cli: 'Run again online (recent rates are fetched), or try another --fx source.',
          },
    })
  }

  const incomplete = disposals.filter(d => d.isIncomplete)
  if (incomplete.length > 0) {
    // Per tax year, e.g. "2024/25: 1, 2025/26: 2", since the summary shows one year at a time
    const countsByYear = new Map<string, number>()
    for (const d of incomplete) countsByYear.set(d.taxYear, (countsByYear.get(d.taxYear) ?? 0) + 1)
    const byYear = [...countsByYear].sort(([a], [b]) => a.localeCompare(b)).map(([year, n]) => `${year}: ${n}`).join(', ')
    issues.push({
      code: 'INCOMPLETE_DISPOSAL',
      id: 'incomplete-disposals',
      flaggedInTable: true,
      severity: 'error',
      title: 'Incomplete Disposal Data',
      description: `${incomplete.length} disposal${s(incomplete.length)} (${byYear}) could not be fully matched to acquisition data, usually because the shares were bought before your imported history starts. Gains/losses are only calculated for matched portions, so the year's totals leave out the unmatched shares.`,
      count: incomplete.length,
      affectedItems: unique(incomplete.map(d => d.disposal.symbol)),
      transactionIds: incomplete.map(d => d.disposal.id),
      remedy: {
        web: 'Look for the red "Incomplete" badge in the transaction list. Import earlier transaction history that includes the original purchases, or manually calculate gains using your original records.',
        cli: 'Import earlier history, or add the missing acquisitions to a Generic CSV (see the normalize command).',
      },
    })
  }

  const skippedFiles = skippedRows.filter(f => f.rows.length > 0)
  if (skippedFiles.length > 0) {
    const rows = skippedFiles.flatMap(f => f.rows)
    const exempt = rows.every(row => row.exempt)
    const one = rows.length === 1
    issues.push({
      code: 'SKIPPED_ROWS',
      id: 'skipped-rows',
      severity: 'warning',
      title: 'Rows Left Out',
      description: `${rows.length} row${s(rows.length)} could not be read and ${one ? 'was' : 'were'} left out: ` +
        skippedFiles.map(f => `"${f.file}" (${describeSkippedRows(f.rows, 5)})`).join('; ') + '. ' +
        (exempt
          ? `${one ? 'It is' : 'They are'} exempt from Capital Gains Tax, so the totals are unaffected.`
          : `The totals will be wrong until ${one ? 'it is' : 'they are'} fixed.`),
      count: rows.length,
      ...(!exempt && {
        remedy: {
          web: `Fix the ${one ? 'row' : 'rows'} and import the ${skippedFiles.length === 1 ? 'file' : 'files'} again.`,
          cli: `Fix ${one ? 'it' : 'them'} and run again.`,
        },
      }),
    })
  }

  const splitConflicts = notices?.splitConflicts ?? []
  if (splitConflicts.length > 0) {
    issues.push({
      code: 'SPLIT_RATIO_CONFLICT',
      id: 'split-conflicts',
      severity: 'warning',
      title: 'Conflicting Stock Split Records',
      description: splitConflicts
        .map(c => `${c.symbol}: used ${c.used.ratio} (${c.used.source}, ${c.used.date}), ignored ${c.ignored.ratio} (${c.ignored.source}, ${c.ignored.date}).`)
        .join(' '),
      count: splitConflicts.length,
      affectedItems: unique(splitConflicts.map(c => c.symbol)),
      transactionIds: splitConflicts.flatMap(c => [c.used.id, c.ignored.id]),
      remedy: both('Check the correct split ratio with the company or your broker. Every quantity after the split depends on it.'),
    })
  }

  const splitDataUnavailableYears = notices?.splitDataUnavailableYears ?? []
  const splitsWithoutRatio = notices?.splitsWithoutRatio ?? []
  if (splitsWithoutRatio.length > 0) {
    issues.push({
      code: 'SPLIT_WITHOUT_RATIO',
      id: 'splits-without-ratio',
      severity: 'warning',
      title: 'Stock Split Without a Ratio',
      description: splitsWithoutRatio.length === 1
        ? `Your files record a stock split for ${splitList(splitsWithoutRatio)} without saying what the ratio was, and no split data covers it, so it could not be applied. Quantities before and after the split won't line up, which can show as incomplete disposals or wrong gains.`
        : `Your files record stock splits for ${splitList(splitsWithoutRatio)} without saying what the ratios were, and no split data covers them, so they could not be applied. Quantities before and after the splits won't line up, which can show as incomplete disposals or wrong gains.`,
      count: splitsWithoutRatio.length,
      affectedItems: unique(splitsWithoutRatio.map(sp => sp.symbol)),
      transactionIds: splitsWithoutRatio.map(sp => sp.id),
      remedy: notices?.autoSplits === false
        ? {
            web: `Turn on "Community split data" in the Transactions section, which may have the ratio. Otherwise ${ADD_SPLIT_ROW_WEB}`,
            cli: `Run again without --no-auto-splits (community split data may have the ratio), or ${ADD_SPLIT_ROW_CLI}`,
          }
        : splitDataUnavailableYears.length > 0
          ? {
              web: `Community split data couldn't be downloaded, so it may still have this split: reload the page to try again. If the warning stays, ${ADD_SPLIT_ROW_WEB}`,
              cli: `Community split data couldn't be downloaded (see SPLIT_DATA_UNAVAILABLE), so it may still have this split: run again online, or ${ADD_SPLIT_ROW_CLI}`,
            }
          : {
              web: `Community split data doesn't have this split, so ${ADD_SPLIT_ROW_WEB}`,
              cli: `Community split data doesn't have this split, so ${ADD_SPLIT_ROW_CLI}`,
            },
    })
  }

  const rejectedSplits = notices?.rejectedSplitRecords ?? []
  if (rejectedSplits.length > 0) {
    issues.push({
      code: 'SPLIT_DATA_REJECTED',
      id: 'rejected-split-data',
      severity: 'warning',
      title: 'Invalid Stock Split Data Ignored',
      description: `Auto-detected stock split data for ${rejectedSplits.map(r => `${r.symbol} (${r.date})`).join(', ')} failed validation and was not applied. ` +
        (rejectedSplits.length === 1
          ? 'If that split really happened, quantities from that date are wrong.'
          : 'If those splits really happened, quantities from those dates are wrong.'),
      count: rejectedSplits.length,
      affectedItems: unique(rejectedSplits.map(r => r.symbol)),
      details: rejectedSplits.map(r => `${r.symbol} ${r.date}: ${REJECTION_REASONS[r.reason] ?? r.reason}`),
      remedy: both(rejectedSplits.length === 1
        ? 'Check whether the share split on that date. If it did, add a STOCK_SPLIT row with the ratio in a Generic CSV file.'
        : 'Check whether the shares split on those dates. For each that did, add a STOCK_SPLIT row with the ratio in a Generic CSV file.'),
    })
  }

  if (splitDataUnavailableYears.length > 0) {
    issues.push({
      code: 'SPLIT_DATA_UNAVAILABLE',
      id: 'split-data-unavailable',
      severity: 'warning',
      title: 'Stock Split Data Unavailable',
      description: `Community stock split data for ${splitDataUnavailableYears.join(', ')} couldn't be downloaded, so splits not recorded in your broker files were not applied. Quantities and costs for any share that split may be wrong.`,
      remedy: {
        web: 'Reload the page to try again, or add STOCK_SPLIT rows in a Generic CSV file.',
        cli: 'Run once online (not with --offline) to cache the data, or add STOCK_SPLIT rows in a Generic CSV.',
      },
    })
  }

  const tickerConflicts = notices?.tickerConflicts ?? []
  if (tickerConflicts.length > 0) {
    issues.push({
      code: 'TICKER_ISIN_CONFLICT',
      id: 'ticker-isin-conflicts',
      severity: 'warning',
      title: 'One Ticker, Several ISINs',
      description: tickerConflicts
        .map(c => c.pooledSeparately
          ? `${c.symbol} appears with ISINs ${c.isins.join(' and ')} at the same time, so it names different securities: rows with an ISIN are pooled separately, and rows without one, or stock split data for ${c.symbol}, can't be assigned to either.`
          : `${c.symbol} changed ISIN (${c.isins.join(' to ')}), usually after a reorganisation, so its rows stay in one pool.`)
        .join(' '),
      count: tickerConflicts.length,
      affectedItems: tickerConflicts.map(c => c.symbol),
      remedy: both('Check which security the rows without an ISIN belong to, and add the ISIN or a distinct symbol in a Generic CSV if needed.'),
    })
  }

  const unknown = transactions.filter(tx => tx.type === 'UNKNOWN')
  if (unknown.length > 0) {
    issues.push({
      code: 'UNKNOWN_TRANSACTION_TYPE',
      id: 'unknown-transaction-types',
      severity: 'warning',
      title: 'Unrecognised Transaction Types',
      description: `${unknown.length} transaction${s(unknown.length)} ${unknown.length !== 1 ? 'have' : 'has'} a type the importer did not recognise and ${unknown.length !== 1 ? 'were' : 'was'} left out of the calculation.`,
      count: unknown.length,
      affectedItems: unique(unknown.map(tx => tx.symbol)),
      transactionIds: unknown.map(tx => tx.id),
      remedy: both(unknown.length === 1
        ? 'If it is a trade, add it with a supported type in a Generic CSV file.'
        : 'If any of them is a trade, add it with a supported type in a Generic CSV file.'),
    })
  }

  // Stock Plan Activity with no price. tx.incomplete only (not !tx.ignored), to match the transaction list
  const incompleteStockPlan = transactions.filter(tx => tx.incomplete)
  if (incompleteStockPlan.length > 0) {
    const symbols = unique(incompleteStockPlan.map(tx => tx.symbol))
    const schwab = incompleteStockPlan.some(tx => tx.source === BrokerType.SCHWAB || tx.source === BrokerType.SCHWAB_EQUITY_AWARDS)
    issues.push({
      code: 'INCOMPLETE_STOCK_PLAN',
      id: 'incomplete-stock-plan',
      flaggedInTable: true,
      severity: 'warning',
      title: 'Incomplete Stock Plan Activity',
      description: `${incompleteStockPlan.length} Stock Plan Activity transaction${s(incompleteStockPlan.length)} for ${symbols.join(', ')} ${incompleteStockPlan.length !== 1 ? 'are' : 'is'} missing price data.`,
      count: incompleteStockPlan.length,
      affectedItems: symbols,
      transactionIds: incompleteStockPlan.map(tx => tx.id),
      remedy: schwab
        ? {
            web: 'Upload your Charles Schwab Equity Awards transaction history (a separate file from the regular Schwab transaction export) to get complete pricing information. See "Supported formats & export guides" in the Import section for instructions.',
            cli: 'Add your Charles Schwab Equity Awards transaction history (a separate file from the regular Schwab transaction export) as another input to get complete pricing information. Run `cgt-visualiser brokers` for export steps.',
          }
        : both(`${incompleteStockPlan.length === 1 ? 'This transaction is' : 'These transactions are'} missing price data required for CGT calculations. Check your broker export for a more complete transaction history.`),
    })
  }

  const overlappingRows = notices?.overlappingRows ?? []
  if (overlappingRows.length > 0) {
    // Brokers often reuse a default export name, so add the file ID when two files share a name
    const fileName = (fileId: string) => {
      const name = fileNames.get(fileId)
      if (!name) return fileId
      const shared = [...fileNames].some(([id, other]) => other === name && id !== fileId)
      return shared ? `${name} (${fileId})` : name
    }
    const plural = overlappingRows.length !== 1
    issues.push({
      code: 'OVERLAPPING_ROWS_REMOVED',
      id: 'overlapping-imports',
      severity: 'info',
      title: 'Overlapping Imports Automatically Merged',
      description: `${overlappingRows.length} row${s(overlappingRows.length)} appeared in more than one imported file from the same broker, so ${plural ? 'each was' : 'it was'} counted once. Nothing to fix if your exports simply cover overlapping dates.`,
      count: overlappingRows.length,
      affectedItems: unique(overlappingRows.map(tx => tx.symbol)),
      transactionIds: overlappingRows.map(tx => tx.id),
      details: (notices?.importOverlaps ?? []).map(o =>
        `${fileName(o.droppedFileId)} overlaps ${fileName(o.keptFileId)}: ${o.rows} row${s(o.rows)}, ` +
        (o.firstDate === o.lastDate ? o.firstDate : `${o.firstDate} to ${o.lastDate}`)
      ),
      remedy: both(plural
        ? 'If any of these were separate trades (for example the same order placed in two accounts), add the missing trade back in a Generic CSV file.'
        : 'If it was a separate trade (for example the same order placed in two accounts), add the missing trade back in a Generic CSV file.'),
    })
  }

  const symbolMerges = notices?.symbolMerges ?? []
  if (symbolMerges.length > 0) {
    issues.push({
      code: 'SYMBOLS_MATCHED_BY_ISIN',
      id: 'symbols-matched-by-isin',
      severity: 'info',
      title: 'Same Security, Different Tickers',
      description: symbolMerges
        .map(m => `${m.mergedSymbols.join(', ')} treated as ${m.symbol} (same ISIN ${m.isin}).`)
        .join(' ') + (symbolMerges.length === 1
          ? ' Their purchases and sales share one Section 104 pool.'
          : ' Each group\'s purchases and sales share one Section 104 pool.'),
      count: symbolMerges.length,
      affectedItems: symbolMerges.map(m => m.symbol),
      remedy: both(symbolMerges.length === 1
        ? 'Check this is the same security.'
        : 'Check each of these is the same security.'),
    })
  }

  if (metadata && metadata.totalBuys > 0 && metadata.totalSells === 0) {
    const { totalBuys } = metadata
    const equityAwards = transactions.some(tx => tx.source === BrokerType.SCHWAB_EQUITY_AWARDS)
    issues.push({
      code: 'NO_DISPOSALS',
      id: 'buy-only-scenario',
      severity: 'info',
      title: 'No Disposals Found',
      description: "No sales found, so there's no capital gain to report.",
      count: totalBuys,
      remedy: equityAwards
        ? {
            web: 'If you did sell, upload your "Transactions" history from Schwab.com (as well as Equity Awards) to include the sales.',
            cli: 'If you did sell, add your "Transactions" history from Schwab.com (as well as Equity Awards) to include the sales.',
          }
        : {
            web: 'If you did sell, import the statements with those sales.',
            cli: 'If you did sell, add the statements with those sales as inputs.',
          },
    })
  }

  return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

/** Split rows as "ACME (2024-06-10, Broker), …" */
function splitList(splits: { symbol: string; date: string; source: string }[]): string {
  return splits.map(sp => `${sp.symbol} (${sp.date}, ${sp.source})`).join(', ')
}

/** A remedy that reads the same in both channels */
function both(text: string): DataIssue['remedy'] {
  return { web: text, cli: text }
}
