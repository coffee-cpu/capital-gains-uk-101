import { describe, it, expect } from 'vitest'
import { normalizeEquatePlusTransactions } from '../equatePlus'
import { TransactionType } from '../../../types/transaction'

describe('EquatePlus Parser', () => {
    describe('normalizeEquatePlusTransactions', () => {
        it('should normalize a SELL transaction', () => {
            const rows = [
                {
                    'Order reference': 'TBPP230615001234',
                    'Date': '15 Jun 2023',
                    'Order type': 'Sell at market price',
                    'Quantity': '1,200',
                    'Status': 'Executed',
                    'Execution price': '£5.25',
                    'Instrument': 'BP Ordinary Shares',
                    'Product type': 'shares',
                    'Strike price / cost basis': '',
                    'Taxes withheld': '£0.00',
                    'Fees': '£15.00',
                    'Net proceeds': '£6,285.00',
                    'Net units': '',
                    'Foreign exchange currency': '',
                    'Foreign exchange rate': '',
                    'Net proceeds after foreign exchange': '',
                },
            ]

            const result = normalizeEquatePlusTransactions(rows, 'test-file')

            expect(result).toHaveLength(1)
            expect(result[0]).toMatchObject({
                id: 'test-file-1',
                source: 'EquatePlus',
                symbol: 'BP',
                name: 'BP Ordinary Shares',
                date: '2023-06-15',
                type: TransactionType.SELL,
                quantity: 1200,
                price: 5.25,
                currency: 'GBP',
                total: 6285.00,
                fee: 15.00,
            })
            expect(result[0].notes).toContain('Order ref: TBPP230615001234')
            expect(result[0].notes).toContain('Fees: £15.00')
        })

        it('should normalize a WITHHOLD-TO-COVER (RSU vest) transaction', () => {
            const rows = [
                {
                    'Order reference': 'TBPP230615000567',
                    'Date': '15 Jun 2023',
                    'Order type': 'Withhold-to-cover',
                    'Quantity': '1,000',
                    'Status': 'Executed',
                    'Execution price': '£5.25',
                    'Instrument': 'BP Ordinary Shares',
                    'Product type': 'restricted stock units',
                    'Strike price / cost basis': '',
                    'Taxes withheld': '£0.00',
                    'Fees': '£0.00',
                    'Net proceeds': '',
                    'Net units': '1,000',
                    'Foreign exchange currency': '',
                    'Foreign exchange rate': '',
                    'Net proceeds after foreign exchange': '',
                },
            ]

            const result = normalizeEquatePlusTransactions(rows, 'test-file')

            expect(result).toHaveLength(1)
            expect(result[0]).toMatchObject({
                id: 'test-file-1',
                source: 'EquatePlus',
                symbol: 'BP',
                name: 'BP Ordinary Shares',
                date: '2023-06-15',
                type: TransactionType.BUY,
                quantity: 1000,
                price: 5.25,
                currency: 'GBP',
                total: 1000 * 5.25,
            })
            expect(result[0].notes).toContain('RSU/RSP vest (withhold-to-cover)')
            expect(result[0].notes).toContain('Product type: restricted stock units')
        })

        it('should skip WITHHOLD-TO-COVER transactions with no net units', () => {
            const rows = [
                {
                    'Order reference': '76384201',
                    'Date': '15 Jun 2023',
                    'Order type': 'Withhold-to-cover',
                    'Quantity': '800',
                    'Status': 'Executed',
                    'Execution price': '-',
                    'Instrument': 'XXX Award',
                    'Product type': 'restricted stock units',
                    'Strike price / cost basis': '-',
                    'Taxes withheld': '-',
                    'Fees': '-',
                    'Net proceeds': '-',
                    'Net units': '-',
                    'Foreign exchange currency': '-',
                    'Foreign exchange rate': '-',
                    'Net proceeds after foreign exchange': '-',
                },
            ]

            const result = normalizeEquatePlusTransactions(rows, 'test-file')

            // This should be skipped because Net units is not a valid number
            expect(result).toHaveLength(0)
        })

        it('should normalize a DIVIDEND transaction', () => {
            const rows = [
                {
                    'Order reference': '893765',
                    'Date': '10 Aug 2023',
                    'Order type': 'Dividend',
                    'Quantity': '100',
                    'Status': 'Executed',
                    'Execution price': '£0.08',
                    'Instrument': 'BP Ordinary Shares',
                    'Product type': 'shares',
                    'Strike price / cost basis': '-',
                    'Taxes withheld': '',
                    'Fees': '',
                    'Net proceeds': '£8.00',
                    'Net units': '',
                    'Foreign exchange currency': '',
                    'Foreign exchange rate': '',
                    'Net proceeds after foreign exchange': '',
                },
            ]

            const result = normalizeEquatePlusTransactions(rows, 'test-file')

            expect(result).toHaveLength(1)
            expect(result[0]).toMatchObject({
                id: 'test-file-1',
                source: 'EquatePlus',
                symbol: 'BP',
                name: 'BP Ordinary Shares',
                date: '2023-08-10',
                type: TransactionType.DIVIDEND,
                quantity: 100,
                price: null,
                currency: 'GBP',
                total: 8.00,
                fee: null,
            })
        })

        it('should skip non-executed transactions', () => {
            const rows = [
                {
                    'Order reference': 'TEST123',
                    'Date': '15 Jun 2023',
                    'Order type': 'Sell at market price',
                    'Quantity': '100',
                    'Status': 'Cancelled',
                    'Execution price': '£5.25',
                    'Instrument': 'BP Ordinary Shares',
                    'Product type': 'shares',
                    'Strike price / cost basis': '',
                    'Taxes withheld': '£0.00',
                    'Fees': '£10.00',
                    'Net proceeds': '£515.00',
                    'Net units': '',
                    'Foreign exchange currency': '',
                    'Foreign exchange rate': '',
                    'Net proceeds after foreign exchange': '',
                },
            ]

            const result = normalizeEquatePlusTransactions(rows, 'test-file')

            // Should be skipped because status is not "Executed"
            expect(result).toHaveLength(0)
        })

        it('should handle multiple transactions correctly', () => {
            const rows = [
                {
                    'Order reference': 'SELL001',
                    'Date': '15 Jun 2023',
                    'Order type': 'Sell at market price',
                    'Quantity': '100',
                    'Status': 'Executed',
                    'Execution price': '£5.25',
                    'Instrument': 'BP Ordinary Shares',
                    'Product type': 'shares',
                    'Strike price / cost basis': '',
                    'Taxes withheld': '£0.00',
                    'Fees': '£10.00',
                    'Net proceeds': '£515.00',
                    'Net units': '',
                    'Foreign exchange currency': '',
                    'Foreign exchange rate': '',
                    'Net proceeds after foreign exchange': '',
                },
                {
                    'Order reference': 'DIV001',
                    'Date': '10 Aug 2023',
                    'Order type': 'Dividend',
                    'Quantity': '100',
                    'Status': 'Executed',
                    'Execution price': '£0.08',
                    'Instrument': 'BP Ordinary Shares',
                    'Product type': 'shares',
                    'Strike price / cost basis': '-',
                    'Taxes withheld': '',
                    'Fees': '',
                    'Net proceeds': '£8.00',
                    'Net units': '',
                    'Foreign exchange currency': '',
                    'Foreign exchange rate': '',
                    'Net proceeds after foreign exchange': '',
                },
            ]

            const result = normalizeEquatePlusTransactions(rows, 'test-file')

            expect(result).toHaveLength(2)
            expect(result[0].type).toBe(TransactionType.SELL)
            expect(result[1].type).toBe(TransactionType.DIVIDEND)
        })

        it('should parse date formats correctly', () => {
            const rows = [
                {
                    'Order reference': 'TEST1',
                    'Date': '1 Jan 2024',
                    'Order type': 'Dividend',
                    'Quantity': '100',
                    'Status': 'Executed',
                    'Execution price': '£0.05',
                    'Instrument': 'BP Ordinary Shares',
                    'Product type': 'shares',
                    'Strike price / cost basis': '-',
                    'Taxes withheld': '',
                    'Fees': '',
                    'Net proceeds': '£5.00',
                    'Net units': '',
                    'Foreign exchange currency': '',
                    'Foreign exchange rate': '',
                    'Net proceeds after foreign exchange': '',
                },
                {
                    'Order reference': 'TEST2',
                    'Date': '31 Dec 2024',
                    'Order type': 'Dividend',
                    'Quantity': '100',
                    'Status': 'Executed',
                    'Execution price': '£0.05',
                    'Instrument': 'BP Ordinary Shares',
                    'Product type': 'shares',
                    'Strike price / cost basis': '-',
                    'Taxes withheld': '',
                    'Fees': '',
                    'Net proceeds': '£5.00',
                    'Net units': '',
                    'Foreign exchange currency': '',
                    'Foreign exchange rate': '',
                    'Net proceeds after foreign exchange': '',
                },
            ]

            const result = normalizeEquatePlusTransactions(rows, 'test-file')

            expect(result).toHaveLength(2)
            expect(result[0].date).toBe('2024-01-01')
            expect(result[1].date).toBe('2024-12-31')
        })

        it('should extract symbols correctly from instrument names', () => {
            const rows = [
                {
                    'Order reference': 'TEST1',
                    'Date': '15 Jun 2023',
                    'Order type': 'Dividend',
                    'Quantity': '100',
                    'Status': 'Executed',
                    'Execution price': '£0.08',
                    'Instrument': 'AAPL Ordinary Shares',
                    'Product type': 'shares',
                    'Strike price / cost basis': '-',
                    'Taxes withheld': '',
                    'Fees': '',
                    'Net proceeds': '£8.00',
                    'Net units': '',
                    'Foreign exchange currency': '',
                    'Foreign exchange rate': '',
                    'Net proceeds after foreign exchange': '',
                },
                {
                    'Order reference': 'TEST2',
                    'Date': '15 Jun 2023',
                    'Order type': 'Dividend',
                    'Quantity': '100',
                    'Status': 'Executed',
                    'Execution price': '£0.08',
                    'Instrument': 'XXX Award',
                    'Product type': 'shares',
                    'Strike price / cost basis': '-',
                    'Taxes withheld': '',
                    'Fees': '',
                    'Net proceeds': '£8.00',
                    'Net units': '',
                    'Foreign exchange currency': '',
                    'Foreign exchange rate': '',
                    'Net proceeds after foreign exchange': '',
                },
            ]

            const result = normalizeEquatePlusTransactions(rows, 'test-file')

            expect(result).toHaveLength(2)
            expect(result[0].symbol).toBe('AAPL')
            expect(result[1].symbol).toBe('XXX')
        })
    })
})

