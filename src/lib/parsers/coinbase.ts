import type { GenericTransaction } from '../../types/transaction'
import { TransactionType } from '../../types/transaction'
import type { RawCSVRow } from '../../types/broker'
import { parseCurrency } from './parsingUtils'
import { CSVPreprocessor, readFileHead } from './fileUtils'

/**
 * Raw-file preprocessor for Coinbase exports (strips metadata rows above the header).
 * Registered in `csvParser.ts`.
 */
export const coinbaseCSVPreprocessor: CSVPreprocessor = {
  matches: isCoinbaseCSV,
  apply: stripCoinbaseMetadataRows,
}

/**
 * Check if a file is a Coinbase CSV by reading the first few lines
 * Coinbase CSVs have a distinctive structure:
 * - Optional blank line(s) at the start
 * - "Transactions" row (may have trailing commas)
 * - "User,<name>,<uuid>,..." row
 */
export async function isCoinbaseCSV(file: File): Promise<boolean> {
  const text = await readFileHead(file, 500)
  if (!text) return false

  const lines = text.split('\n').filter(line => line.trim())
  return lines.length >= 2 && lines[0].startsWith('Transactions') && lines[1].startsWith('User')
}

/**
 * Strip the metadata rows from a Coinbase CSV file and return a new File
 * Coinbase CSVs have:
 * - Optional blank line(s) at the start
 * - "Transactions" row
 * - "User,<name>,<uuid>,..." row
 * - Actual headers row
 * - Data rows
 *
 * We need to remove everything before the actual headers row (which starts with "ID")
 */
export async function stripCoinbaseMetadataRows(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) {
        reject(new Error('Failed to read file'))
        return
      }

      // Split by lines and find where the actual headers start
      const lines = text.split('\n')

      // Find the index of the header row (starts with "ID")
      let headerRowIndex = -1
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const trimmedLine = lines[i].trim()
        if (trimmedLine.startsWith('ID,') || trimmedLine.startsWith('ID\t')) {
          headerRowIndex = i
          break
        }
      }

      if (headerRowIndex === -1) {
        reject(new Error('Could not find Coinbase CSV headers'))
        return
      }

      // Rejoin from the header row onwards
      const csvWithoutMetadata = lines.slice(headerRowIndex).join('\n')

      // Create a new File object with the stripped content
      const strippedFile = new File([csvWithoutMetadata], file.name, { type: file.type })
      resolve(strippedFile)
    }
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    reader.readAsText(file)
  })
}


/**
 * Coinbase CSV Parser
 *
 * Converts Coinbase transaction exports to GenericTransaction format
 *
 * Note: The first 2 metadata rows are skipped by parseCoinbaseCSV() in csvParser.ts
 * before this function is called. So the rows we receive already have proper headers.
 *
 * Expected columns:
 * - ID: Unique transaction ID
 * - Timestamp: Transaction timestamp (YYYY-MM-DD HH:MM:SS UTC)
 * - Transaction Type: Type of transaction (Buy, Sell, Send, Receive, Staking Income, etc.)
 * - Asset: Crypto symbol (BTC, ETH, XTZ, etc.)
 * - Quantity Transacted: Amount of crypto
 * - Price Currency: Currency code (GBP, USD, EUR)
 * - Price at Transaction: Price per unit with currency symbol
 * - Subtotal: Subtotal before fees
 * - Total (inclusive of fees and/or spread): Total including fees
 * - Fees and/or Spread: Fee amount
 * - Notes: Additional info
 */

type TransactionTypeValue = typeof TransactionType[keyof typeof TransactionType]

/**
 * Map Coinbase transaction type to GenericTransaction type
 * Note: 'convert' and 'reward income' transactions are handled specially in normalizeCoinbaseTransactions
 * to generate multiple transactions.
 */
function mapTransactionType(transactionType: string): TransactionTypeValue | null {
  const typeLower = transactionType.toLowerCase()

  // Buy transactions (including Advanced Trade Buy)
  if (typeLower === 'buy' || typeLower === 'advanced trade buy') return TransactionType.BUY

  // Sell transactions (including Advanced Trade Sell)
  if (typeLower === 'sell' || typeLower === 'advanced trade sell') return TransactionType.SELL

  // Reward Income and Staking Income - return null to signal special handling
  // Both generate two transactions: INTEREST (taxable income) + BUY (cost basis for CGT)
  if (typeLower === 'reward income' || typeLower === 'staking income') return null

  // Transfers - Send, Receive, Deposit, Withdrawal, Pro Deposit, Pro Withdrawal
  if (
    typeLower === 'send' ||
    typeLower === 'receive' ||
    typeLower === 'deposit' ||
    typeLower === 'withdrawal' ||
    typeLower === 'pro deposit' ||
    typeLower === 'pro withdrawal'
  )
    return TransactionType.TRANSFER

  // Convert transactions (crypto to crypto) - return null to signal special handling
  if (typeLower === 'convert') return null

  // Retail staking/unstaking transfers - internal movements, treat as TRANSFER
  if (
    typeLower === 'retail staking transfer' ||
    typeLower === 'retail unstaking transfer' ||
    typeLower === 'retail eth2 deprecation'
  )
    return TransactionType.TRANSFER

  // Unknown types
  console.warn(`Unknown Coinbase transaction type: "${transactionType}", marking as UNKNOWN`)
  return TransactionType.UNKNOWN
}

/**
 * Parse Convert transaction Notes field to extract acquired asset details
 * Expected format: "Converted X.XX ASSET1 to Y.YY ASSET2"
 * Returns { acquiredAsset, acquiredQuantity } or null if parsing fails
 */
function parseConvertNotes(
  notes: string | undefined
): { acquiredAsset: string; acquiredQuantity: number } | null {
  if (!notes) return null

  // Match pattern: "Converted X.XX ASSET1 to Y.YY ASSET2"
  const match = notes.match(/Converted\s+[\d.]+\s+\w+\s+to\s+([\d.]+)\s+(\w+)/i)
  if (!match) return null

  const acquiredQuantity = parseFloat(match[1])
  const acquiredAsset = match[2]

  if (isNaN(acquiredQuantity) || !acquiredAsset) return null

  return { acquiredAsset, acquiredQuantity }
}

/**
 * Parse Coinbase date format: "YYYY-MM-DD HH:MM:SS UTC" -> "YYYY-MM-DD"
 */
function parseDate(dateStr: string): string {
  // Coinbase uses: "2025-12-31 11:08:09 UTC"
  // We need: "2025-12-31"
  return dateStr.split(' ')[0]
}

/**
 * Parse quantity, handling scientific notation (e.g., "2.63622E-05")
 */
function parseQuantity(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null

  const parsed = parseFloat(value)
  return isNaN(parsed) ? null : parsed
}

/**
 * Normalize Coinbase transactions to GenericTransaction format
 *
 * Note: Convert transactions (crypto-to-crypto) generate TWO transactions:
 * 1. SELL of the original asset (disposal - taxable event)
 * 2. BUY of the acquired asset (acquisition - establishes cost basis)
 *
 * Per HMRC CRYPTO22100, exchanging one cryptocurrency for another is a disposal.
 */
export function normalizeCoinbaseTransactions(
  rows: RawCSVRow[],
  fileId: string
): GenericTransaction[] {
  const transactions: GenericTransaction[] = []
  let transactionIndex = 1

  for (const row of rows) {
    const transactionType = row['Transaction Type']
    const timestamp = row['Timestamp']
    const asset = row['Asset']

    // Skip rows without essential data (handles metadata rows)
    if (!transactionType || !timestamp || !asset) continue

    // Skip if this looks like a header row
    if (transactionType === 'Transaction Type') continue

    const type = mapTransactionType(transactionType)

    // Parse numeric fields
    const quantity = parseQuantity(row['Quantity Transacted'])
    const price = parseCurrency(row['Price at Transaction'])
    const subtotal = parseCurrency(row['Subtotal'])
    const total = parseCurrency(row['Total (inclusive of fees and/or spread)'])
    const fee = parseCurrency(row['Fees and/or Spread'])

    // Get currency - Coinbase provides 'Price Currency' column
    const currency = row['Price Currency'] || 'GBP'

    // For total, prefer 'Total (inclusive of fees and/or spread)' for accuracy
    // Use subtotal as fallback, then calculate from price * quantity
    let finalTotal: number | null = null
    if (total !== null) {
      finalTotal = Math.abs(total) // Coinbase uses negative for some transactions
    } else if (subtotal !== null) {
      finalTotal = Math.abs(subtotal)
    } else if (price !== null && quantity !== null) {
      finalTotal = Math.abs(price * quantity)
    }

    // Handle quantity - Coinbase uses negative for Send transactions
    const finalQuantity = quantity !== null ? Math.abs(quantity) : null

    // Handle Reward Income and Staking Income specially - generates both INTEREST and BUY transactions
    // Per HMRC:
    // 1. INTEREST: The value received is taxable as miscellaneous income
    // 2. BUY: Establishes cost basis for CGT when the crypto is later sold
    const typeLower = transactionType.toLowerCase()
    if (type === null && (typeLower === 'reward income' || typeLower === 'staking income')) {
      const notes = row['Notes'] || ''
      const incomeType = typeLower === 'staking income' ? 'Staking Income' : 'Reward Income'

      // Create INTEREST transaction for income tax purposes
      const interestTransaction: GenericTransaction = {
        id: `${fileId}-${transactionIndex++}`,
        source: 'Coinbase',
        date: parseDate(timestamp),
        type: 'INTEREST',
        symbol: asset,
        name: null,
        quantity: finalQuantity,
        price: price !== null ? Math.abs(price) : null,
        currency,
        total: finalTotal,
        fee: fee !== null ? Math.abs(fee) : null,
        notes: notes ? `[${incomeType} - Taxable] ${notes}` : `[${incomeType} - Taxable]`,
      }
      transactions.push(interestTransaction)

      // Create BUY transaction for CGT cost basis
      const buyTransaction: GenericTransaction = {
        id: `${fileId}-${transactionIndex++}`,
        source: 'Coinbase',
        date: parseDate(timestamp),
        type: TransactionType.BUY,
        symbol: asset,
        name: null,
        quantity: finalQuantity,
        price: price !== null ? Math.abs(price) : null,
        currency,
        total: finalTotal,
        fee: 0, // Fee already accounted for in INTEREST transaction
        notes: notes ? `[${incomeType} - Cost Basis] ${notes}` : `[${incomeType} - Cost Basis]`,
      }
      transactions.push(buyTransaction)

      continue
    }

    // Handle Convert transactions specially - they generate two transactions
    // Per HMRC CRYPTO22100: exchanging crypto for crypto is a disposal
    if (type === null && transactionType.toLowerCase() === 'convert') {
      const notes = row['Notes'] || ''
      const convertInfo = parseConvertNotes(notes)

      // Create SELL transaction for the disposed asset
      const sellTransaction: GenericTransaction = {
        id: `${fileId}-${transactionIndex++}`,
        source: 'Coinbase',
        date: parseDate(timestamp),
        type: TransactionType.SELL,
        symbol: asset,
        name: null,
        quantity: finalQuantity,
        price: price !== null ? Math.abs(price) : null,
        currency,
        total: finalTotal,
        fee: fee !== null ? Math.abs(fee) : null,
        notes: notes ? `[Convert - Disposal] ${notes}` : '[Convert - Disposal]',
      }
      transactions.push(sellTransaction)

      // Create BUY transaction for the acquired asset (if we could parse the Notes)
      if (convertInfo) {
        // Calculate price for acquired asset: same total value / acquired quantity
        const acquiredPrice =
          finalTotal !== null && convertInfo.acquiredQuantity > 0
            ? finalTotal / convertInfo.acquiredQuantity
            : null

        const buyTransaction: GenericTransaction = {
          id: `${fileId}-${transactionIndex++}`,
          source: 'Coinbase',
          date: parseDate(timestamp),
          type: TransactionType.BUY,
          symbol: convertInfo.acquiredAsset,
          name: null,
          quantity: convertInfo.acquiredQuantity,
          price: acquiredPrice,
          currency,
          total: finalTotal, // Same GBP value as the SELL
          fee: 0, // Fee already accounted for in the SELL transaction
          notes: notes ? `[Convert - Acquisition] ${notes}` : '[Convert - Acquisition]',
        }
        transactions.push(buyTransaction)
      } else {
        // Could not parse Notes field - log warning
        console.warn(
          `Coinbase Convert: Could not parse acquired asset from Notes: "${notes}". ` +
            `Only SELL transaction created. BUY transaction for acquired asset must be added manually.`
        )
      }

      continue
    }

    // For non-convert transactions, type should not be null
    if (type === null) {
      console.warn(`Unexpected null type for transaction type: "${transactionType}"`)
      continue
    }

    const transaction: GenericTransaction = {
      id: `${fileId}-${transactionIndex++}`,
      source: 'Coinbase',
      date: parseDate(timestamp),
      type,
      symbol: asset,
      name: null, // Coinbase doesn't provide full asset names in CSV
      quantity: finalQuantity,
      price: price !== null ? Math.abs(price) : null,
      currency,
      total: finalTotal,
      fee: fee !== null ? Math.abs(fee) : null,
      notes: row['Notes'] || null,
    }

    transactions.push(transaction)
  }

  return transactions
}
