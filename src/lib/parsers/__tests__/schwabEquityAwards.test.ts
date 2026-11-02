import { describe, it, expect } from 'vitest'
import { normalizeSchwabEquityAwardsTransactions } from '../schwabEquityAwards'
import { TransactionType } from '../../../types/transaction'
import type { RawCSVRow } from '../../../types/broker'

describe('normalizeSchwabEquityAwardsTransactions', () => {
  it('should parse RSU vest transactions with tax withholding', () => {
    const rows: RawCSVRow[] = [
      // Transaction row
      {
        'Date': '08/15/2024',
        'Action': 'Lapse',
        'Symbol': 'AAPL',
        'Description': 'Restricted Stock Lapse',
        'Quantity': '100',
        'FeesAndCommissions': '',
        'DisbursementElection': '',
        'Amount': '',
        'AwardDate': '',
        'AwardId': '',
        'FairMarketValuePrice': '',
        'SalePrice': '',
        'SharesSoldWithheldForTaxes': '',
        'NetSharesDeposited': '',
        'Taxes': '',
      },
      // Detail row
      {
        'Date': '',
        'Action': '',
        'Symbol': '',
        'Description': '',
        'Quantity': '',
        'FeesAndCommissions': '',
        'DisbursementElection': '',
        'Amount': '',
        'AwardDate': '03/20/2023',
        'AwardId': '123456',
        'FairMarketValuePrice': '$150.00',
        'SalePrice': '',
        'SharesSoldWithheldForTaxes': '48',
        'NetSharesDeposited': '52',
        'Taxes': '$7,200.00',
      },
    ]

    const transactions = normalizeSchwabEquityAwardsTransactions(rows, 'test-file')

    expect(transactions).toHaveLength(1)
    expect(transactions[0]).toMatchObject({
      id: 'test-file-1',
      source: 'Charles Schwab Equity Awards',
      symbol: 'AAPL',
      name: 'Restricted Stock Lapse',
      date: '2024-08-15',
      type: TransactionType.BUY,
      quantity: 52, // Net shares after tax withholding
      price: 150.00, // FMV price
      currency: 'USD',
      total: 7800, // 52 net shares * $150
      fee: null,
    })
    expect(transactions[0].notes).toContain('100 shares vested')
    expect(transactions[0].notes).toContain('48 sold for taxes')
    expect(transactions[0].notes).toContain('52 net shares deposited')
    expect(transactions[0].notes).toContain('$7200.00')
  })

  it('should parse multiple transactions', () => {
    const rows: RawCSVRow[] = [
      // First transaction pair
      {
        'Date': '08/15/2024',
        'Action': 'Lapse',
        'Symbol': 'AAPL',
        'Description': 'Restricted Stock Lapse',
        'Quantity': '100',
        'FeesAndCommissions': '',
        'DisbursementElection': '',
        'Amount': '',
        'AwardDate': '',
        'AwardId': '',
        'FairMarketValuePrice': '',
        'SalePrice': '',
        'SharesSoldWithheldForTaxes': '',
        'NetSharesDeposited': '',
        'Taxes': '',
      },
      {
        'Date': '',
        'Action': '',
        'Symbol': '',
        'Description': '',
        'Quantity': '',
        'FeesAndCommissions': '',
        'DisbursementElection': '',
        'Amount': '',
        'AwardDate': '03/20/2023',
        'AwardId': '123456',
        'FairMarketValuePrice': '$150.00',
        'SalePrice': '',
        'SharesSoldWithheldForTaxes': '48',
        'NetSharesDeposited': '52',
        'Taxes': '$7,200.00',
      },
      // Second transaction pair
      {
        'Date': '05/15/2024',
        'Action': 'Lapse',
        'Symbol': 'MSFT',
        'Description': 'Restricted Stock Lapse',
        'Quantity': '50',
        'FeesAndCommissions': '',
        'DisbursementElection': '',
        'Amount': '',
        'AwardDate': '',
        'AwardId': '',
        'FairMarketValuePrice': '',
        'SalePrice': '',
        'SharesSoldWithheldForTaxes': '',
        'NetSharesDeposited': '',
        'Taxes': '',
      },
      {
        'Date': '',
        'Action': '',
        'Symbol': '',
        'Description': '',
        'Quantity': '',
        'FeesAndCommissions': '',
        'DisbursementElection': '',
        'Amount': '',
        'AwardDate': '03/20/2024',
        'AwardId': '123457',
        'FairMarketValuePrice': '$350.00',
        'SalePrice': '',
        'SharesSoldWithheldForTaxes': '24',
        'NetSharesDeposited': '26',
        'Taxes': '$8,400.00',
      },
    ]

    const transactions = normalizeSchwabEquityAwardsTransactions(rows, 'test-file')

    expect(transactions).toHaveLength(2)

    expect(transactions[0]).toMatchObject({
      id: 'test-file-1',
      symbol: 'AAPL',
      date: '2024-08-15',
      quantity: 52,
      price: 150.00,
    })

    expect(transactions[1]).toMatchObject({
      id: 'test-file-2',
      symbol: 'MSFT',
      date: '2024-05-15',
      quantity: 26,
      price: 350.00,
    })
  })

  it('should handle transactions with no tax withholding', () => {
    const rows: RawCSVRow[] = [
      {
        'Date': '08/15/2024',
        'Action': 'Lapse',
        'Symbol': 'AAPL',
        'Description': 'Restricted Stock Lapse',
        'Quantity': '100',
        'FeesAndCommissions': '',
        'DisbursementElection': '',
        'Amount': '',
        'AwardDate': '',
        'AwardId': '',
        'FairMarketValuePrice': '',
        'SalePrice': '',
        'SharesSoldWithheldForTaxes': '',
        'NetSharesDeposited': '',
        'Taxes': '',
      },
      {
        'Date': '',
        'Action': '',
        'Symbol': '',
        'Description': '',
        'Quantity': '',
        'FeesAndCommissions': '',
        'DisbursementElection': '',
        'Amount': '',
        'AwardDate': '03/20/2023',
        'AwardId': '123456',
        'FairMarketValuePrice': '$150.00',
        'SalePrice': '',
        'SharesSoldWithheldForTaxes': '0',
        'NetSharesDeposited': '100',
        'Taxes': '$0.00',
      },
    ]

    const transactions = normalizeSchwabEquityAwardsTransactions(rows, 'test-file')

    expect(transactions).toHaveLength(1)
    expect(transactions[0].quantity).toBe(100)
    expect(transactions[0].notes).toBeNull()
  })

  it('should mark unknown actions as UNKNOWN', () => {
    const rows: RawCSVRow[] = [
      {
        'Date': '08/15/2024',
        'Action': 'Sale',
        'Symbol': 'AAPL',
        'Description': 'Stock Sale',
        'Quantity': '100',
        'FeesAndCommissions': '',
        'DisbursementElection': '',
        'Amount': '',
        'AwardDate': '',
        'AwardId': '',
        'FairMarketValuePrice': '',
        'SalePrice': '',
        'SharesSoldWithheldForTaxes': '',
        'NetSharesDeposited': '',
        'Taxes': '',
      },
      {
        'Date': '',
        'Action': '',
        'Symbol': '',
        'Description': '',
        'Quantity': '',
        'FeesAndCommissions': '',
        'DisbursementElection': '',
        'Amount': '',
        'AwardDate': '03/20/2023',
        'AwardId': '123456',
        'FairMarketValuePrice': '$150.00',
        'SalePrice': '',
        'SharesSoldWithheldForTaxes': '0',
        'NetSharesDeposited': '100',
        'Taxes': '$0.00',
      },
    ]

    const transactions = normalizeSchwabEquityAwardsTransactions(rows, 'test-file')

    expect(transactions).toHaveLength(1)
    expect(transactions[0].type).toBe('UNKNOWN')
    expect(transactions[0].symbol).toBe('AAPL')
  })

  it('should skip invalid rows', () => {
    const rows: RawCSVRow[] = [
      {
        'Date': '',
        'Action': 'Lapse',
        'Symbol': 'AAPL',
        'Description': 'Restricted Stock Lapse',
        'Quantity': '100',
        'FeesAndCommissions': '',
        'DisbursementElection': '',
        'Amount': '',
        'AwardDate': '',
        'AwardId': '',
        'FairMarketValuePrice': '',
        'SalePrice': '',
        'SharesSoldWithheldForTaxes': '',
        'NetSharesDeposited': '',
        'Taxes': '',
      },
      {
        'Date': '',
        'Action': '',
        'Symbol': '',
        'Description': '',
        'Quantity': '',
        'FeesAndCommissions': '',
        'DisbursementElection': '',
        'Amount': '',
        'AwardDate': '03/20/2023',
        'AwardId': '123456',
        'FairMarketValuePrice': '$150.00',
        'SalePrice': '',
        'SharesSoldWithheldForTaxes': '0',
        'NetSharesDeposited': '100',
        'Taxes': '$0.00',
      },
    ]

    const transactions = normalizeSchwabEquityAwardsTransactions(rows, 'test-file')

    expect(transactions).toHaveLength(0)
  })
})

describe('normalizeSchwabEquityAwardsTransactions - row grouping', () => {
  const lapse = (date: string, quantity: string): RawCSVRow => ({
    'Date': date, 'Action': 'Lapse', 'Symbol': 'AAPL', 'Description': 'Restricted Stock Lapse', 'Quantity': quantity,
  })
  const lapseDetail = (fmv: string, sold: string, net: string, taxes: string): RawCSVRow => ({
    'Date': '', 'FairMarketValuePrice': fmv, 'SharesSoldWithheldForTaxes': sold, 'NetSharesDeposited': net, 'Taxes': taxes,
  })
  const noDetails = (date: string, action: string): RawCSVRow => ({
    'Date': date, 'Action': action, 'Symbol': 'AAPL', 'Description': action, 'Quantity': '', 'Amount': '$12.00',
  })

  it('keeps every vest when a row without detail rows sits between them', () => {
    const result = normalizeSchwabEquityAwardsTransactions([
      lapse('08/15/2024', '100'), lapseDetail('$150.00', '48', '52', '$7,200.00'),
      noDetails('07/01/2024', 'Dividend'),
      lapse('05/15/2024', '50'), lapseDetail('$160.00', '24', '26', '$3,840.00'),
    ], 'f')

    const vests = result.filter(tx => tx.type === TransactionType.BUY)
    expect(vests.map(tx => [tx.date, tx.quantity, tx.price])).toEqual([
      ['2024-08-15', 52, 150],
      ['2024-05-15', 26, 160],
    ])
  })

  it('sums shares when a vest has one detail row per award', () => {
    const [vest] = normalizeSchwabEquityAwardsTransactions([
      lapse('08/15/2024', '1,000'),
      lapseDetail('$150.00', '400', '600', '$60,000.00'),
      lapseDetail('$150.00', '20', '30', '$3,000.00'),
    ], 'f')

    expect(vest.quantity).toBe(630)
    expect(vest.price).toBe(150)
    expect(vest.notes).toContain('1000 shares vested, 420 sold for taxes ($63000.00), 630 net shares deposited')
  })

  it('flags a vest with no detail rows instead of recording a 0-share purchase', () => {
    const [tx] = normalizeSchwabEquityAwardsTransactions([lapse('08/15/2024', '100')], 'f')

    expect(tx.type).toBe(TransactionType.UNKNOWN)
    expect(tx.quantity).toBe(100)
    expect(tx.notes).toContain('missing its award detail row')
  })

  it('treats a wire transfer as a transfer', () => {
    const [tx] = normalizeSchwabEquityAwardsTransactions([noDetails('07/01/2024', 'Wire Transfer')], 'f')
    expect(tx.type).toBe(TransactionType.TRANSFER)
  })
})
