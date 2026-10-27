import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createFileId, importCSVText } from '../import'
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

  it('throws when the format cannot be detected', () => {
    const csv = 'foo,bar,baz\n1,2,3'

    expect(() => importCSVText(csv, 'unknown')).toThrow('Could not detect CSV format')
  })
})
