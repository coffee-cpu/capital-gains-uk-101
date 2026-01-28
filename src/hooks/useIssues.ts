import { useMemo } from 'react'
import { useTransactionStore } from '../stores/transactionStore'
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
        ? 'Add a gbp_value column to your CSV with the GBP spot price for crypto transactions.'
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

      issues.push({
        id: 'incomplete-disposals',
        type: 'error',
        title: 'Incomplete Disposal Data',
        description: `${allIncompleteDisposals.length} disposal${allIncompleteDisposals.length !== 1 ? 's' : ''} could not be fully matched to acquisition data. Gains/losses are only calculated for matched portions.`,
        count: allIncompleteDisposals.length,
        affectedItems: affectedSymbols,
        action: 'Import earlier transaction history that includes the original purchases, or manually calculate gains using your original records.',
        actionLabel: 'Import Earlier History',
      })
    }
  }

  // 3. Check for incomplete Stock Plan Activity (WARNING severity)
  // Note: Check tx.incomplete only (not !tx.ignored) to match TransactionList behavior
  const incompleteTransactions = transactions.filter(tx => tx.incomplete)
  if (incompleteTransactions.length > 0) {
    const incompleteSymbols = [...new Set(incompleteTransactions.map(tx => tx.symbol).filter(Boolean))]

    // Check if incomplete transactions are from Schwab to provide specific advice
    const hasSchwabIncomplete = incompleteTransactions.some(
      tx => tx.source === 'Charles Schwab' || tx.source === 'Charles Schwab Equity Awards'
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
        tx => tx.source === 'Charles Schwab Equity Awards'
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
  const transactions = useTransactionStore((state) => state.transactions)
  const cgtResults = useTransactionStore((state) => state.cgtResults)

  return useMemo(
    () => detectIssues(transactions, cgtResults),
    [transactions, cgtResults]
  )
}
