import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createFileId, describeSkippedRows, importCSVText } from '../import'
import { getEnabledBrokerDefinitions } from '../../config/brokers'
import { BrokerType } from '../../types/broker'

const PUBLIC_DIR = join(__dirname, '../../../public')

function readExample(exampleFile: string): string {
  return readFileSync(join(PUBLIC_DIR, exampleFile), 'utf-8')
}

describe('createFileId', () => {
  it('sanitises the file name and appends the size', () => {
    expect(createFileId('my-transactions.csv', 12345)).toBe('my_transactions_csv-12345')
  })
})

describe('importCSVText', () => {
  describe('broker example files', () => {
    const definitions = getEnabledBrokerDefinitions().filter(def => def.exampleFile)

    it.each(definitions.map(def => [def.displayName, def] as const))(
      'detects and parses the %s example',
      (_name, definition) => {
        const result = importCSVText(readExample(definition.exampleFile!), 'example')

        expect(result.broker).toBe(definition.type)
        expect(result.confidence).toBeGreaterThanOrEqual(0.8)
        expect(result.transactions.length).toBeGreaterThan(0)
        expect(result.transactions.every(tx => tx.id.startsWith('example-'))).toBe(true)
      }
    )
  })

  it('strips a UTF-8 byte order mark before detection', () => {
    const text = readExample('/examples/schwab-transactions-example.csv')

    const withBom = importCSVText('﻿' + text, 'bom')
    const withoutBom = importCSVText(text, 'bom')

    expect(withBom.broker).toBe(BrokerType.SCHWAB)
    expect(withBom.transactions).toEqual(withoutBom.transactions)
  })

  it('normalizes renamed symbols', () => {
    const csv = [
      'date,type,symbol,currency,quantity,price,total,fee',
      '2021-01-04,BUY,FB,USD,10,270,2700,0',
    ].join('\n')

    const result = importCSVText(csv, 'generic')

    expect(result.broker).toBe(BrokerType.GENERIC)
    expect(result.transactions[0].symbol).toBe('META')
  })

  it('reports Generic CSV rows that could not be read', () => {
    const csv = [
      'date,type,symbol,currency,quantity,price,total,fee',
      '2024-01-02,BUY,VOD,GBP,100,1,100,0',
      '2024-06-03,SEL,VOD,GBP,100,2,200,0',
      ',SELL,VOD,GBP,50,2,100,0',
    ].join('\n')

    const result = importCSVText(csv, 'typo')

    expect(result.transactions).toHaveLength(1)
    expect(result.skippedRows).toEqual([
      { row: 3, reason: 'unrecognised type "SEL"' },
      { row: 4, reason: 'missing date' },
    ])
  })

  it('ignores blank spreadsheet rows such as ",,,,"', () => {
    const csv = [
      'date,type,symbol,currency,quantity,price,total,fee',
      '2024-01-02,BUY,VOD,GBP,100,1,100,0',
      ',,,,,,,',
      ' , , ,,,,,',
    ].join('\n')

    const result = importCSVText(csv, 'blank-rows')

    expect(result.transactions).toHaveLength(1)
    expect(result.skippedRows).toEqual([])
  })

  it('reports no skipped rows for a clean file', () => {
    const result = importCSVText(readExample('/examples/generic-example.csv'), 'clean')

    expect(result.skippedRows).toEqual([])
  })

  it('explains why when every row is skipped', () => {
    const csv = 'date,type,symbol,currency,quantity,price,total,fee\n2024-06-03,SEL,VOD,GBP,100,2,200,0'

    expect(() => importCSVText(csv, 'all-bad')).toThrow('No valid transactions found in CSV (row 2: unrecognised type "SEL")')
  })

  it('summarises long lists of skipped rows', () => {
    const rows = [1, 2, 3, 4, 5].map(row => ({ row, reason: 'missing date' }))

    expect(describeSkippedRows(rows)).toBe('row 1: missing date; row 2: missing date; row 3: missing date, and 2 more')
  })

  it('throws when the format cannot be detected', () => {
    const csv = 'foo,bar,baz\n1,2,3'

    expect(() => importCSVText(csv, 'unknown')).toThrow('Could not detect CSV format')
  })
})
