import { BrokerType } from '../types/broker'
import { useMemo } from 'react'
import { useTransactionStore, selectTransactions } from '../stores/transactionStore'
import type { EnrichedTransaction } from '../types/transaction'
import type { CGTCalculationResult } from '../types/cgt'

/**
 * Issue types for the issues panel
 */
export type IssueType = 'error' | 'warning' | 'info'

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
}

/**
 * Pure function to detect issues from transaction data
 * Exported for testing purposes
 */
export function detectIssues(
  transactions: EnrichedTransaction[],
  cgtResults: CGTCalculationResult | null
): Issue[] {
  const issues: Issue[] = []

  // Skip if no transactions loaded
  if (transactions.length === 0) {
    return issues
  }

  // 1. Check for FX rate errors (ERROR severity)
  const fxErrorTransactions = transactions.filter(tx => tx.fx_error)
  if (fxErrorTransactions.length > 0) {
    const hasCryptoError = fxErrorTransactions.some(tx => tx.fx_error?.includes('Crypto currency'))
    const affectedSymbols = [...new Set(fxErrorTransactions.map(tx => tx.symbol).filter(Boolean))]

    issues.push({
      id: 'fx-rate-errors',
      type: 'error',
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
    })
  }

  // 2. Check for incomplete disposals (ERROR severity)
  // Show ALL incomplete disposals across ALL tax years, not just the selected one
  if (cgtResults) {
    const allIncompleteDisposals = cgtResults.disposals.filter(d => d.isIncomplete)
    if (allIncompleteDisposals.length > 0) {
      const affectedSymbols = [...new Set(allIncompleteDisposals.map(d => d.disposal.symbol).filter(Boolean))]
      // Per tax year, e.g. "2024/25: 1, 2025/26: 2", since the summary shows one year at a time
      const countsByYear = new Map<string, number>()
      for (const d of allIncompleteDisposals) countsByYear.set(d.taxYear, (countsByYear.get(d.taxYear) ?? 0) + 1)
      const byYear = [...countsByYear].sort(([a], [b]) => a.localeCompare(b)).map(([year, n]) => `${year}: ${n}`).join(', ')

      issues.push({
        id: 'incomplete-disposals',
        type: 'error',
        title: 'Incomplete Disposal Data',
        description: `${allIncompleteDisposals.length} disposal${allIncompleteDisposals.length !== 1 ? 's' : ''} (${byYear}) could not be fully matched to acquisition data, usually because the shares were bought before your imported history starts. Gains/losses are only calculated for matched portions; look for the red "Incomplete" badge in the transaction list.`,
        count: allIncompleteDisposals.length,
        affectedItems: affectedSymbols,
        action: 'Import earlier transaction history that includes the original purchases, or manually calculate gains using your original records.',
        actionLabel: 'Import Earlier History',
      })
    }
  }

  // Rows dropped as overlapping imports, and split records that disagreed
  // (WARNING severity): both change the figures, so the user should check them
  const overlappingRows = cgtResults?.dataNotices?.overlappingRows ?? []
  if (overlappingRows.length > 0) {
    const affectedSymbols = [...new Set(overlappingRows.map(tx => tx.symbol).filter(Boolean))]

    issues.push({
      id: 'overlapping-imports',
      type: 'warning',
      title: 'Overlapping Imports',
      description: `${overlappingRows.length} row${overlappingRows.length !== 1 ? 's' : ''} also appeared in another imported file from the same broker and ${overlappingRows.length !== 1 ? 'were' : 'was'} counted once. This is expected when exports cover overlapping dates.`,
      count: overlappingRows.length,
      affectedItems: affectedSymbols,
      action: 'If any of these were separate trades (for example the same order placed in two accounts), add the missing trade back in a Generic CSV file.',
      actionLabel: 'Check Rows',
    })
  }

  const splitConflicts = cgtResults?.dataNotices?.splitConflicts ?? []
  if (splitConflicts.length > 0) {
    issues.push({
      id: 'split-conflicts',
      type: 'warning',
      title: 'Conflicting Stock Split Records',
      description: splitConflicts
        .map(c => `${c.symbol}: used ${c.used.ratio} (${c.used.source}, ${c.used.date}), ignored ${c.ignored.ratio} (${c.ignored.source}, ${c.ignored.date}).`)
        .join(' '),
      count: splitConflicts.length,
      affectedItems: [...new Set(splitConflicts.map(c => c.symbol))],
      action: 'Check the correct split ratio with the company or your broker. Every quantity after the split depends on it.',
      actionLabel: 'Check Split Ratio',
    })
  }

  const splitsWithoutRatio = cgtResults?.dataNotices?.splitsWithoutRatio ?? []
  if (splitsWithoutRatio.length > 0) {
    issues.push({
      id: 'splits-without-ratio',
      type: 'warning',
      title: 'Stock Split Without a Ratio',
      description: `Your files record a stock split for ${splitsWithoutRatio.map(s => `${s.symbol} (${s.date}, ${s.source})`).join(', ')} without saying what the ratio was, and no split data covers it, so it could not be applied. Quantities before and after the split won't line up, which can show as incomplete disposals or wrong gains.`,
      count: splitsWithoutRatio.length,
      affectedItems: [...new Set(splitsWithoutRatio.map(s => s.symbol))],
      action: 'Turn on "Community split data" in the Transactions section if it is off. Otherwise add a STOCK_SPLIT row with the ratio (e.g. 10:1) in a Generic CSV file.',
      actionLabel: 'Add Split Ratio',
    })
  }

  const rejectedSplits = cgtResults?.dataNotices?.rejectedSplitRecords ?? []
  if (rejectedSplits.length > 0) {
    issues.push({
      id: 'rejected-split-data',
      type: 'warning',
      title: 'Invalid Stock Split Data Ignored',
      description: `Auto-detected stock split data for ${rejectedSplits.map(r => `${r.symbol} (${r.date})`).join(', ')} failed validation and was not applied. If that split really happened, quantities from that date are wrong.`,
      count: rejectedSplits.length,
      affectedItems: [...new Set(rejectedSplits.map(r => r.symbol))],
      action: 'Check whether the share split on that date. If it did, add a STOCK_SPLIT row with the ratio in a Generic CSV file.',
      actionLabel: 'Check Split',
    })
  }

  const symbolMerges = cgtResults?.dataNotices?.symbolMerges ?? []
  if (symbolMerges.length > 0) {
    issues.push({
      id: 'symbols-matched-by-isin',
      type: 'info',
      title: 'Same Security, Different Tickers',
      description: symbolMerges
        .map(m => `${m.mergedSymbols.join(', ')} treated as ${m.symbol} (same ISIN ${m.isin}).`)
        .join(' ') + ' Their purchases and sales share one Section 104 pool.',
      count: symbolMerges.length,
      affectedItems: symbolMerges.map(m => m.symbol),
    })
  }

  const tickerConflicts = cgtResults?.dataNotices?.tickerConflicts ?? []
  if (tickerConflicts.length > 0) {
    issues.push({
      id: 'ticker-isin-conflicts',
      type: 'warning',
      title: 'One Ticker, Several ISINs',
      description: tickerConflicts
        .map(c => c.pooledSeparately
          ? `${c.symbol} appears with ISINs ${c.isins.join(' and ')} at the same time, so it names different securities: rows with an ISIN are pooled separately, and rows without one, or stock split data for ${c.symbol}, can't be assigned to either.`
          : `${c.symbol} changed ISIN (${c.isins.join(' to ')}), usually after a reorganisation, so its rows stay in one pool.`)
        .join(' '),
      count: tickerConflicts.length,
      affectedItems: tickerConflicts.map(c => c.symbol),
      action: 'Check which security the rows without an ISIN belong to, and add the ISIN or a distinct symbol in a Generic CSV if needed.',
      actionLabel: 'Check Tickers',
    })
  }

  // 3. Check for incomplete Stock Plan Activity (WARNING severity)
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
      type: 'warning',
      title: 'Incomplete Stock Plan Activity',
      description: `${incompleteTransactions.length} Stock Plan Activity transaction${incompleteTransactions.length !== 1 ? 's' : ''} for ${incompleteSymbols.join(', ')} ${incompleteSymbols.length !== 1 ? 'are' : 'is'} missing price data.`,
      count: incompleteTransactions.length,
      affectedItems: incompleteSymbols,
      action: hasSchwabIncomplete
        ? 'Upload your Charles Schwab Equity Awards transaction history (a separate file from the regular Schwab transaction export) to get complete pricing information. See "Supported formats & export guides" in the Import section for instructions.'
        : 'These transactions are missing price data required for CGT calculations. Check your broker export for a more complete transaction history.',
      actionLabel: hasSchwabIncomplete ? 'Upload Equity Awards File' : 'Check Export',
    })
  }

  // 4. Check for buy-only scenario (INFO severity)
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

  return useMemo(
    () => detectIssues(transactions, cgtResults),
    [transactions, cgtResults]
  )
}
