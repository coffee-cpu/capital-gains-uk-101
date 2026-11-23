import { BrokerType } from '../types/broker'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/db'
import { findDataIssues, type DataIssue, type DataIssueSeverity, type MissingRatioRemedy } from '../lib/issues'
import { useTransactionStore, selectTransactions } from '../stores/transactionStore'
import type { EnrichedTransaction } from '../types/transaction'
import type { CGTCalculationResult } from '../types/cgt'

/**
 * Issue types for the issues panel
 */
export type IssueType = DataIssueSeverity

/**
 * Represents an aggregated issue that needs user attention
 */
export interface Issue {
  /** Unique identifier for this issue type */
  id: string
  /** Severity level */
  type: IssueType
  /** Short title describing the issue */
  title: string
  /** Detailed description with actionable information */
  description: string
  /** Number of affected items */
  count?: number
  /** List of affected item identifiers (e.g., symbols, transaction IDs) */
  affectedItems?: string[]
  /** Suggested action to resolve the issue */
  action?: string
  /** Label for the action button/link */
  actionLabel?: string
  /** One line per item worth listing, e.g. each pair of overlapping files */
  details?: string[]
  /** True when the table highlights the affected rows (and "Needs attention" lists them) */
  flaggedInTable?: boolean
}

/**
 * Pure function to detect issues from transaction data
 *
 * The data issues come from the engine (`findDataIssues`, shared with the
 * CLI's warnings) and are worded here for the panel; the import advice
 * (incomplete Stock Plan Activity, no disposals) is the web app's own.
 * Exported for testing purposes
 */
export function detectIssues(
  transactions: EnrichedTransaction[],
  cgtResults: CGTCalculationResult | null,
  /** Imported file names by file ID, to name files in notices (falls back to the ID) */
  fileNames: ReadonlyMap<string, string> = new Map()
): Issue[] {
  const issues: Issue[] = []

  // Skip if no transactions loaded
  if (transactions.length === 0) {
    return issues
  }

  // Incomplete disposals are listed across all tax years, not just the selected one
  const dataIssues = findDataIssues({
    transactions,
    disposals: cgtResults?.disposals ?? [],
    dataNotices: cgtResults?.dataNotices,
  })
  for (const dataIssue of dataIssues) {
    const issue = toPanelIssue(dataIssue, fileNames)
    if (issue) issues.push(issue)
  }

  // Incomplete Stock Plan Activity (WARNING severity)
  // Note: Check tx.incomplete only (not !tx.ignored) to match TransactionList behavior
  const incompleteTransactions = transactions.filter(tx => tx.incomplete)
  if (incompleteTransactions.length > 0) {
    const incompleteSymbols = [...new Set(incompleteTransactions.map(tx => tx.symbol).filter(Boolean))]

    // Check if incomplete transactions are from Schwab to provide specific advice
    const hasSchwabIncomplete = incompleteTransactions.some(
      tx => tx.source === BrokerType.SCHWAB || tx.source === BrokerType.SCHWAB_EQUITY_AWARDS
    )

    issues.push({
      id: 'incomplete-stock-plan',
      flaggedInTable: true,
      type: 'warning',
      title: 'Incomplete Stock Plan Activity',
      description: `${incompleteTransactions.length} Stock Plan Activity transaction${incompleteTransactions.length !== 1 ? 's' : ''} for ${incompleteSymbols.join(', ')} ${incompleteTransactions.length !== 1 ? 'are' : 'is'} missing price data.`,
      count: incompleteTransactions.length,
      affectedItems: incompleteSymbols,
      action: hasSchwabIncomplete
        ? 'Upload your Charles Schwab Equity Awards transaction history (a separate file from the regular Schwab transaction export) to get complete pricing information. See "Supported formats & export guides" in the Import section for instructions.'
        : 'These transactions are missing price data required for CGT calculations. Check your broker export for a more complete transaction history.',
      actionLabel: hasSchwabIncomplete ? 'Upload Equity Awards File' : 'Check Export',
    })
  }

  // Buy-only scenario (INFO severity)
  if (cgtResults?.metadata) {
    const { totalBuys, totalSells } = cgtResults.metadata
    if (totalBuys > 0 && totalSells === 0) {
      // Check if any transactions are from Schwab Equity Awards
      const hasSchwabEquityAwards = transactions.some(
        tx => tx.source === BrokerType.SCHWAB_EQUITY_AWARDS
      )

      issues.push({
        id: 'buy-only-scenario',
        type: 'info',
        title: 'No Disposals Found',
        description: `You've imported ${totalBuys} BUY transaction${totalBuys !== 1 ? 's' : ''} (purchases, RSU vests) but no SELL transactions. CGT calculations require disposals.`,
        count: totalBuys,
        action: hasSchwabEquityAwards
          ? 'Upload your "Transactions" history from Schwab.com (in addition to Equity Awards) to include SELL transactions.'
          : 'Upload brokerage statements containing your SELL transactions to calculate capital gains.',
        actionLabel: 'Upload SELL Transactions',
      })
    }
  }

  // Sort by severity: errors first, then warnings, then info
  const severityOrder: Record<IssueType, number> = {
    error: 0,
    warning: 1,
    info: 2,
  }

  return issues.sort((a, b) => severityOrder[a.type] - severityOrder[b.type])
}

/**
 * Hook to aggregate all issues from transactions and CGT results
 *
 * Returns issues sorted by severity (errors first, then warnings, then info)
 */
export function useIssues(): Issue[] {
  const transactions = useTransactionStore(selectTransactions)
  const cgtResults = useTransactionStore((state) => state.cgtResults)
  const [fileNames, setFileNames] = useState<ReadonlyMap<string, string>>(() => new Map())

  // Every import or clear recalculates, so reload the file names with the results
  useEffect(() => {
    let cancelled = false
    db.imported_files.toArray()
      .then(files => {
        if (!cancelled) setFileNames(new Map(files.map(f => [f.fileId, f.filename])))
      })
      .catch(() => { /* names are optional; notices fall back to file IDs */ })
    return () => { cancelled = true }
  }, [cgtResults])

  return useMemo(
    () => detectIssues(transactions, cgtResults, fileNames),
    [transactions, cgtResults, fileNames]
  )
}

/**
 * The Issues panel's wording for a data issue found by the engine, or null
 * for the kinds the panel doesn't list
 */
function toPanelIssue(issue: DataIssue, fileNames: ReadonlyMap<string, string>): Issue | null {
  switch (issue.code) {
    case 'FX_RATE_MISSING': {
      const fxErrorTransactions = issue.transactions
      const hasCryptoError = fxErrorTransactions.some(tx => tx.fx_error?.includes('Crypto currency'))
      const affectedSymbols = [...new Set(fxErrorTransactions.map(tx => tx.symbol).filter(Boolean))]
      return {
        id: 'fx-rate-errors',
        flaggedInTable: true,
        type: issue.severity,
        title: 'FX Rate Errors',
        description: hasCryptoError
          ? `Failed to fetch exchange rates for ${fxErrorTransactions.length} transaction${fxErrorTransactions.length !== 1 ? 's' : ''}. Crypto currencies require manual GBP values.`
          : `Failed to fetch exchange rates for ${fxErrorTransactions.length} transaction${fxErrorTransactions.length !== 1 ? 's' : ''}. GBP values cannot be calculated.`,
        count: fxErrorTransactions.length,
        affectedItems: affectedSymbols,
        action: hasCryptoError
          ? 'Automatic FX conversion is not supported for crypto. For crypto-to-crypto trades, add a gbp_value column to your CSV with the GBP spot price of the quote currency at the time of each trade, then re-import.'
          : 'Try selecting a different FX source from the dropdown in the Transactions section.',
        actionLabel: hasCryptoError ? 'Manual Fix Required' : 'Change FX Source',
      }
    }

    case 'INCOMPLETE_DISPOSAL': {
      const allIncompleteDisposals = issue.disposals
      const affectedSymbols = [...new Set(allIncompleteDisposals.map(d => d.disposal.symbol).filter(Boolean))]
      // Per tax year, e.g. "2024/25: 1, 2025/26: 2", since the summary shows one year at a time
      const countsByYear = new Map<string, number>()
      for (const d of allIncompleteDisposals) countsByYear.set(d.taxYear, (countsByYear.get(d.taxYear) ?? 0) + 1)
      const byYear = [...countsByYear].sort(([a], [b]) => a.localeCompare(b)).map(([year, n]) => `${year}: ${n}`).join(', ')
      return {
        id: 'incomplete-disposals',
        flaggedInTable: true,
        type: issue.severity,
        title: 'Incomplete Disposal Data',
        description: `${allIncompleteDisposals.length} disposal${allIncompleteDisposals.length !== 1 ? 's' : ''} (${byYear}) could not be fully matched to acquisition data, usually because the shares were bought before your imported history starts. Gains/losses are only calculated for matched portions; look for the red "Incomplete" badge in the transaction list.`,
        count: allIncompleteDisposals.length,
        affectedItems: affectedSymbols,
        action: 'Import earlier transaction history that includes the original purchases, or manually calculate gains using your original records.',
        actionLabel: 'Import Earlier History',
      }
    }

    case 'OVERLAPPING_ROWS_REMOVED': {
      // Resolved automatically, so it's a notice rather than something to fix
      const overlappingRows = issue.rows
      const affectedSymbols = [...new Set(overlappingRows.map(tx => tx.symbol).filter(Boolean))]
      // Brokers often reuse a default export name, so add the file ID when two files share a name
      const fileName = (fileId: string) => {
        const name = fileNames.get(fileId)
        if (!name) return fileId
        const shared = [...fileNames].some(([id, other]) => other === name && id !== fileId)
        return shared ? `${name} (${fileId})` : name
      }
      const plural = overlappingRows.length !== 1
      return {
        id: 'overlapping-imports',
        type: issue.severity,
        title: 'Overlapping Imports Automatically Merged',
        description: `${overlappingRows.length} row${plural ? 's' : ''} appeared in more than one imported file from the same broker, so ${plural ? 'each was' : 'it was'} counted once. Nothing to fix if your exports simply cover overlapping dates.`,
        count: overlappingRows.length,
        affectedItems: affectedSymbols,
        details: issue.overlaps.map(o =>
          `${fileName(o.droppedFileId)} overlaps ${fileName(o.keptFileId)}: ${o.rows} row${o.rows !== 1 ? 's' : ''}, ` +
          (o.firstDate === o.lastDate ? o.firstDate : `${o.firstDate} to ${o.lastDate}`)
        ),
        action: 'If any of these were separate trades (for example the same order placed in two accounts), add the missing trade back in a Generic CSV file.',
        actionLabel: 'Check Rows',
      }
    }

    case 'SPLIT_RATIO_CONFLICT':
      return {
        id: 'split-conflicts',
        type: issue.severity,
        title: 'Conflicting Stock Split Records',
        description: issue.conflicts
          .map(c => `${c.symbol}: used ${c.used.ratio} (${c.used.source}, ${c.used.date}), ignored ${c.ignored.ratio} (${c.ignored.source}, ${c.ignored.date}).`)
          .join(' '),
        count: issue.conflicts.length,
        affectedItems: [...new Set(issue.conflicts.map(c => c.symbol))],
        action: 'Check the correct split ratio with the company or your broker. Every quantity after the split depends on it.',
        actionLabel: 'Check Split Ratio',
      }

    case 'SPLIT_WITHOUT_RATIO':
      return {
        id: 'splits-without-ratio',
        type: issue.severity,
        title: 'Stock Split Without a Ratio',
        description: `Your files record a stock split for ${issue.splits.map(s => `${s.symbol} (${s.date}, ${s.source})`).join(', ')} without saying what the ratio was, and no split data covers it, so it could not be applied. Quantities before and after the split won't line up, which can show as incomplete disposals or wrong gains.`,
        count: issue.splits.length,
        affectedItems: [...new Set(issue.splits.map(s => s.symbol))],
        action: splitsWithoutRatioAction(issue.remedy),
        actionLabel: 'Add Split Ratio',
      }

    case 'SPLIT_DATA_REJECTED':
      return {
        id: 'rejected-split-data',
        type: issue.severity,
        title: 'Invalid Stock Split Data Ignored',
        description: `Auto-detected stock split data for ${issue.records.map(r => `${r.symbol} (${r.date})`).join(', ')} failed validation and was not applied. If that split really happened, quantities from that date are wrong.`,
        count: issue.records.length,
        affectedItems: [...new Set(issue.records.map(r => r.symbol))],
        action: 'Check whether the share split on that date. If it did, add a STOCK_SPLIT row with the ratio in a Generic CSV file.',
        actionLabel: 'Check Split',
      }

    case 'SYMBOLS_MATCHED_BY_ISIN':
      return {
        id: 'symbols-matched-by-isin',
        type: issue.severity,
        title: 'Same Security, Different Tickers',
        description: issue.merges
          .map(m => `${m.mergedSymbols.join(', ')} treated as ${m.symbol} (same ISIN ${m.isin}).`)
          .join(' ') + ' Their purchases and sales share one Section 104 pool.',
        count: issue.merges.length,
        affectedItems: issue.merges.map(m => m.symbol),
      }

    case 'TICKER_ISIN_CONFLICT':
      return {
        id: 'ticker-isin-conflicts',
        type: issue.severity,
        title: 'One Ticker, Several ISINs',
        description: issue.conflicts
          .map(c => c.pooledSeparately
            ? `${c.symbol} appears with ISINs ${c.isins.join(' and ')} at the same time, so it names different securities: rows with an ISIN are pooled separately, and rows without one, or stock split data for ${c.symbol}, can't be assigned to either.`
            : `${c.symbol} changed ISIN (${c.isins.join(' to ')}), usually after a reorganisation, so its rows stay in one pool.`)
          .join(' '),
        count: issue.conflicts.length,
        affectedItems: issue.conflicts.map(c => c.symbol),
        action: 'Check which security the rows without an ISIN belong to, and add the ISIN or a distinct symbol in a Generic CSV if needed.',
        actionLabel: 'Check Tickers',
      }

    case 'UNKNOWN_TRANSACTION_TYPE':
      // Not listed in the panel: the transaction list shows these rows with an UNKNOWN badge
      return null
  }
}

/**
 * What to do about a split row without a ratio, depending on whether
 * community split data was looked up, and whether it could be downloaded
 */
function splitsWithoutRatioAction(remedy: MissingRatioRemedy): string {
  const addRow = 'add a STOCK_SPLIT row with the ratio (e.g. 10:1) in a Generic CSV file.'
  switch (remedy) {
    case 'enable-auto-splits':
      return `Turn on "Community split data" in the Transactions section, which may have the ratio. Otherwise ${addRow}`
    case 'retry-split-data':
      return `Community split data couldn't be downloaded, so it may still have this split: reload the page to try again. If the warning stays, ${addRow}`
    case 'add-split-row':
      return `Community split data doesn't have this split, so ${addRow}`
  }
}
