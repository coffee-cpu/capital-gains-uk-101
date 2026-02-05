import { GenericTransaction, TransactionType } from '../../types/transaction'
import { RawCSVRow } from '../../types/broker'
import { parseCurrency } from './parsingUtils'

/**
 * Normalize EquatePlus CSV rows to GenericTransaction format
 * @param rows Raw CSV rows
 * @param fileId Unique identifier for this file (e.g. 'equateplus-abc123')
 */
export function normalizeEquatePlusTransactions(rows: RawCSVRow[], fileId: string): GenericTransaction[] {
    const transactions: GenericTransaction[] = []
    let rowIndex = 1

    for (const row of rows) {
        const normalized = normalizeEquatePlusRow(row, fileId, rowIndex)
        if (normalized) {
            transactions.push(normalized)
            rowIndex++
        }
    }

    return transactions
}

/**
 * Normalize a single EquatePlus row
 */
function normalizeEquatePlusRow(row: RawCSVRow, fileId: string, rowIndex: number): GenericTransaction | null {
    const orderType = row['Order type']?.trim()
    const status = row['Status']?.trim()
    const productType = row['Product type']?.trim()

    // Only process executed transactions
    if (status !== 'Executed') {
        return null
    }

    // Parse date
    const date = parseEquatePlusDate(row['Date']?.trim())
    if (!date) {
        return null
    }

    // Handle different transaction types based on "Order type"
    if (orderType === 'Sell at market price') {
        return parseSellTransaction(row, fileId, rowIndex, date)
    } else if (orderType === 'Withhold-to-cover') {
        return parseWithholdToCoverTransaction(row, fileId, rowIndex, date, productType)
    } else if (orderType === 'Dividend') {
        return parseDividendTransaction(row, fileId, rowIndex, date)
    }

    // Skip unknown order types
    return null
}

/**
 * Parse "Sell at market price" transaction
 */
function parseSellTransaction(
    row: RawCSVRow,
    fileId: string,
    rowIndex: number,
    date: string
): GenericTransaction | null {
    const instrument = row['Instrument']?.trim() || ''
    const symbol = extractSymbol(instrument)
    const quantity = parseCurrency(row['Quantity'])
    const executionPrice = parseCurrency(row['Execution price'])
    const fees = parseCurrency(row['Fees']) || 0
    const netProceeds = parseCurrency(row['Net proceeds'])
    const orderRef = row['Order reference']?.trim()

    const notes = []
    if (orderRef) notes.push(`Order ref: ${orderRef}`)
    if (instrument) notes.push(`Instrument: ${instrument}`)
    if (fees > 0) notes.push(`Fees: £${fees.toFixed(2)}`)

    return {
        id: `${fileId}-${rowIndex}`,
        source: 'EquatePlus',
        symbol: symbol || '',
        name: instrument || null,
        date,
        type: TransactionType.SELL,
        quantity,
        price: executionPrice,
        currency: 'GBP',
        total: netProceeds !== null ? Math.abs(netProceeds) : null,
        fee: fees > 0 ? fees : null,
        ratio: null,
        notes: notes.length > 0 ? notes.join(', ') : null,
        incomplete: false,
        ignored: false,
    }
}

/**
 * Parse "Withhold-to-cover" transaction
 * This represents shares acquired (e.g., RSUs vesting) or shares withheld for taxes
 */
function parseWithholdToCoverTransaction(
    row: RawCSVRow,
    fileId: string,
    rowIndex: number,
    date: string,
    productType: string | undefined
): GenericTransaction | null {
    const instrument = row['Instrument']?.trim() || ''
    const symbol = extractSymbol(instrument)
    const netUnits = parseCurrency(row['Net units'])
    const executionPrice = parseCurrency(row['Execution price'])
    const orderRef = row['Order reference']?.trim()

    // If Net units is provided and positive, this is an acquisition (RSU vest)
    // If Net units is 0 or negative, shares were withheld for taxes (not an acquisition we care about)
    if (!netUnits || netUnits === 0) {
        // This is just shares withheld for taxes, not a real acquisition
        // We can skip it or mark it as ignored
        return null
    }

    const notes = []
    if (orderRef) notes.push(`Order ref: ${orderRef}`)
    if (instrument) notes.push(`Instrument: ${instrument}`)
    if (productType) notes.push(`Product type: ${productType}`)
    notes.push('RSU/RSP vest (withhold-to-cover)')

    // For RSU vesting, the acquisition price is the FMV at vest (execution price)
    // The quantity is the net shares received after withholding
    return {
        id: `${fileId}-${rowIndex}`,
        source: 'EquatePlus',
        symbol: symbol || '',
        name: instrument || null,
        date,
        type: TransactionType.BUY,
        quantity: netUnits,
        price: executionPrice,
        currency: 'GBP',
        total: executionPrice && netUnits ? executionPrice * netUnits : null,
        fee: null,
        ratio: null,
        notes: notes.length > 0 ? notes.join(', ') : null,
        incomplete: false,
        ignored: false,
    }
}

/**
 * Parse "Dividend" transaction
 */
function parseDividendTransaction(
    row: RawCSVRow,
    fileId: string,
    rowIndex: number,
    date: string
): GenericTransaction | null {
    const instrument = row['Instrument']?.trim() || ''
    const symbol = extractSymbol(instrument)
    const quantity = parseCurrency(row['Quantity'])
    const netProceeds = parseCurrency(row['Net proceeds'])
    const orderRef = row['Order reference']?.trim()

    const notes = []
    if (orderRef) notes.push(`Order ref: ${orderRef}`)
    if (instrument) notes.push(`Instrument: ${instrument}`)

    return {
        id: `${fileId}-${rowIndex}`,
        source: 'EquatePlus',
        symbol: symbol || '',
        name: instrument || null,
        date,
        type: TransactionType.DIVIDEND,
        quantity, // Number of shares eligible for dividend
        price: null,
        currency: 'GBP',
        total: netProceeds,
        fee: null,
        ratio: null,
        notes: notes.length > 0 ? notes.join(', ') : null,
        incomplete: false,
        ignored: false,
    }
}

/**
 * Extract stock symbol from instrument name
 * E.g., "BP Ordinary Shares" -> "BP"
 */
function extractSymbol(instrument: string): string {
    if (!instrument) return ''

    // Common patterns:
    // "BP Ordinary Shares" -> "BP"
    // "XXX Award" -> "XXX"
    const parts = instrument.split(' ')

    // If it ends with "Ordinary Shares", "Shares", "Award", etc., take the first part
    if (parts.length > 1) {
        const lastWord = parts[parts.length - 1].toLowerCase()
        if (lastWord === 'shares' || lastWord === 'award' || lastWord === 'stock') {
            return parts[0]
        }
    }

    // Otherwise, return the first word
    return parts[0]
}

/**
 * Parse EquatePlus date format: "6 Nov 2025" or "14 Aug 2025"
 * Returns ISO date string (YYYY-MM-DD) or null
 */
function parseEquatePlusDate(dateStr: string): string | null {
    if (!dateStr) return null

    const monthMap: Record<string, string> = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    }

    // Match format: "6 Nov 2025" or "14 Aug 2025"
    const match = dateStr.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
    if (!match) return null

    const [, day, month, year] = match
    const monthNum = monthMap[month]
    if (!monthNum) return null

    const dayPadded = day.padStart(2, '0')
    return `${year}-${monthNum}-${dayPadded}`
}


