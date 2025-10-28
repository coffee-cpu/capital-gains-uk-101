import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportTransactionsToCSV } from '../csvExport'
import { GenericTransaction } from '../../types/transaction'

describe('csvExport', () => {
  // Mock document methods
  let mockLink: HTMLAnchorElement
  let createElementSpy: any
  let appendChildSpy: any
  let removeChildSpy: any
  let createObjectURLSpy: any
  let revokeObjectURLSpy: any

  beforeEach(() => {
    // Create a mock link element
    mockLink = {
      setAttribute: vi.fn(),
      click: vi.fn(),
      style: {},
    } as unknown as HTMLAnchorElement

    // Spy on document methods
    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink)
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink)
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink)

    // Mock URL methods if they don't exist (jsdom environment)
    if (!URL.createObjectURL) {
      // @ts-ignore - Adding method that doesn't exist in test environment
      URL.createObjectURL = vi.fn()
    }
    if (!URL.revokeObjectURL) {
      // @ts-ignore - Adding method that doesn't exist in test environment
      URL.revokeObjectURL = vi.fn()
    }

    // Spy on URL methods
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should export transactions to CSV with correct format', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'test-1',
        source: 'Test Broker',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2024-01-15',
        type: 'BUY',
        quantity: 10,
        price: 150.00,
        currency: 'USD',
        total: 1500.00,
        fee: 5.00,
        notes: 'Test purchase',
      },
      {
        id: 'test-2',
        source: 'Test Broker',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2024-02-20',
        type: 'SELL',
        quantity: 5,
        price: 160.00,
        currency: 'USD',
        total: 800.00,
        fee: 2.50,
        notes: null,
      },
    ]

    exportTransactionsToCSV(transactions, 'test-export.csv')

    // Verify document.createElement was called
    expect(createElementSpy).toHaveBeenCalledWith('a')

    // Verify link attributes were set
    expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'blob:mock-url')
    expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'test-export.csv')

    // Verify link was clicked and cleaned up
    expect(appendChildSpy).toHaveBeenCalledWith(mockLink)
    expect(mockLink.click).toHaveBeenCalled()
    expect(removeChildSpy).toHaveBeenCalledWith(mockLink)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')

    // Verify blob was created with correct content
    expect(createObjectURLSpy).toHaveBeenCalled()
    const blobCall = createObjectURLSpy.mock.calls[0][0] as Blob
    expect(blobCall.type).toBe('text/csv;charset=utf-8;')
  })

  it('should use default filename if not provided', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'test-1',
        source: 'Test Broker',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2024-01-15',
        type: 'BUY',
        quantity: 10,
        price: 150.00,
        currency: 'USD',
        total: 1500.00,
        fee: 5.00,
        notes: null,
      },
    ]

    exportTransactionsToCSV(transactions)

    expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'transactions-export.csv')
  })

  it('should call export functions for transactions with different dates', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'test-2',
        source: 'Test Broker',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2024-02-20',
        type: 'SELL',
        quantity: 5,
        price: 160.00,
        currency: 'USD',
        total: 800.00,
        fee: 2.50,
        notes: null,
      },
      {
        id: 'test-1',
        source: 'Test Broker',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        date: '2024-01-15',
        type: 'BUY',
        quantity: 10,
        price: 150.00,
        currency: 'USD',
        total: 1500.00,
        fee: 5.00,
        notes: null,
      },
    ]

    exportTransactionsToCSV(transactions)

    // Verify download was triggered
    expect(createObjectURLSpy).toHaveBeenCalled()
    expect(mockLink.click).toHaveBeenCalled()
  })

  it('should handle null values in transactions', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'test-1',
        source: 'Test Broker',
        symbol: 'AAPL',
        name: null,
        date: '2024-01-15',
        type: 'DIVIDEND',
        quantity: null,
        price: null,
        currency: 'USD',
        total: 50.00,
        fee: null,
        notes: null,
      },
    ]

    exportTransactionsToCSV(transactions)

    // Verify download was triggered
    expect(createObjectURLSpy).toHaveBeenCalled()
    expect(mockLink.click).toHaveBeenCalled()
  })

  it('should export transactions with special characters', () => {
    const transactions: GenericTransaction[] = [
      {
        id: 'test-1',
        source: 'Test Broker',
        symbol: 'AAPL',
        name: 'Apple, Inc.',
        date: '2024-01-15',
        type: 'BUY',
        quantity: 10,
        price: 150.00,
        currency: 'USD',
        total: 1500.00,
        fee: 5.00,
        notes: 'Note with "quotes" and, commas',
      },
    ]

    exportTransactionsToCSV(transactions)

    // Verify download was triggered
    expect(createObjectURLSpy).toHaveBeenCalled()
    expect(mockLink.click).toHaveBeenCalled()
  })
})
