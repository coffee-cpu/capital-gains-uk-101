import { describe, it, expect } from 'vitest'
import { normalizeSchwabTransactions } from '../../parsers/schwab'
import { calculateCGT } from '../engine'
import { EnrichedTransaction } from '../../../types/transaction'

describe('Options Expiration', () => {
  it('should handle buy-to-open option that expires worthless (total loss)', () => {
    // Scenario: Buy to Open a call option that expires worthless
    // This tests a long options position that becomes a total loss:
    // 1. Buy to Open (pay premium) - ACQUISITION
    // 2. Expired with negative quantity (option expires worthless) - DISPOSAL at £0
    //
    // NVDA 02/23/2024 1080.00 C:
    // - 02/16/2024 Buy to Open: 1 contract @ $0.93 + $0.66 fee = $93.66 cost
    // - 02/26/2024 Expired: -1 contract (worthless)
    // - Loss: $0 proceeds - $93.66 cost = -$93.66

    const rows = [
      {
        Date: '02/16/2024',
        Action: 'Buy to Open',
        Symbol: 'NVDA 02/23/2024 1080.00 C',
        Description: 'CALL NVIDIA CORP $1080 EXP 02/23/24',
        Quantity: '1',
        Price: '$0.93',
        'Fees & Comm': '$0.66',
        Amount: '-$93.66'
      },
      {
        Date: '02/26/2024 as of 02/23/2024',
        Action: 'Expired',
        Symbol: 'NVDA 02/23/2024 1080.00 C',
        Description: 'CALL NVIDIA CORP $1080 EXP 02/23/24',
        Quantity: '-1',
        Price: '',
        'Fees & Comm': '',
        Amount: ''
      }
    ]

    const transactions = normalizeSchwabTransactions(rows, 'test-nvda-expired')

    console.log('\n=== Parsed Transactions (NVDA Buy to Open -> Expired) ===')
    transactions.forEach(tx => {
      console.log(`${tx.type}: symbol=${tx.symbol}, qty=${tx.quantity}, price=${tx.price}, total=${tx.total}, fee=${tx.fee}`)
    })

    // Verify parsing
    expect(transactions).toHaveLength(2)
    expect(transactions[0].type).toBe('OPTIONS_BUY_TO_OPEN')
    expect(transactions[0].quantity).toBe(1)
    expect(transactions[0].price).toBeCloseTo(0.93, 2)
    expect(transactions[1].type).toBe('OPTIONS_EXPIRED')
    expect(transactions[1].quantity).toBe(-1) // Negative = closing long position

    // Enrich transactions
    const enriched: EnrichedTransaction[] = transactions.map(tx => ({
      ...tx,
      fx_rate: 1,
      price_gbp: tx.price,
      value_gbp: tx.total ? Math.abs(tx.total) : 0,
      fee_gbp: tx.fee,
      fx_source: 'test',
      tax_year: '2023/24',
      gain_group: 'NONE' as const,
    }))

    console.log('\n=== Enriched Transactions ===')
    enriched.forEach(tx => {
      console.log(`${tx.type}: symbol=${tx.symbol}, qty=${tx.quantity}, price_gbp=${tx.price_gbp}, value_gbp=${tx.value_gbp}, contract_size=${tx.contract_size}`)
    })

    const result = calculateCGT(enriched)

    console.log('\n=== CGT Results (NVDA Expired) ===')
    console.log('Number of disposals:', result.disposals.length)
    result.disposals.forEach((d, i) => {
      console.log(`\nDisposal ${i + 1}: ${d.disposal.symbol}`)
      console.log(`  Type: ${d.disposal.type}`)
      console.log(`  Date: ${d.disposal.date}`)
      console.log(`  Quantity: ${d.disposal.quantity}`)
      console.log(`  Proceeds: ${d.proceedsGbp.toFixed(2)}`)
      console.log(`  Costs: ${d.allowableCostsGbp.toFixed(2)}`)
      console.log(`  Gain/Loss: ${d.gainOrLossGbp.toFixed(2)}`)
      console.log(`  Rules: ${d.matchings.map(m => m.rule).join(', ')}`)
      console.log(`  Incomplete: ${d.isIncomplete}`)
    })

    console.log('\n=== Transaction gain_groups ===')
    result.transactions.forEach(tx => {
      console.log(`  ${tx.type} (${tx.symbol}) on ${tx.date}: gain_group=${tx.gain_group}`)
    })

    console.log('\n=== Section 104 Pools ===')
    for (const [symbol, pool] of result.section104Pools) {
      console.log(`${symbol}: qty=${pool.quantity}, cost=${pool.totalCostGbp.toFixed(2)}, avg=${pool.averageCostGbp.toFixed(2)}`)
      console.log('  History:')
      pool.history.forEach(h => {
        console.log(`    ${h.date} ${h.type}: qty=${h.quantity}, cost=${h.costOrProceeds.toFixed(2)}, balance=${h.balanceQuantity}`)
      })
    }

    // Should have 1 disposal (the expired option)
    expect(result.disposals.length).toBe(1)

    const disposal = result.disposals[0]
    expect(disposal.disposal.symbol).toBe('NVDA 02/23/2024 1080.00 C')
    expect(disposal.disposal.type).toBe('OPTIONS_EXPIRED')

    // The expired option should be matched via Section 104 pool
    // (Buy to Open adds to pool, Expired removes from pool)
    expect(disposal.matchings[0]?.rule).toBe('SECTION_104')

    // Expected calculation:
    // Proceeds: $0 (expired worthless)
    // Cost basis: $0.93 * 1 * 100 + $0.66 = $93.66
    // Loss: $0 - $93.66 = -$93.66
    expect(disposal.proceedsGbp).toBe(0)
    expect(disposal.allowableCostsGbp).toBeCloseTo(93.66, 1)
    expect(disposal.gainOrLossGbp).toBeCloseTo(-93.66, 1)
    expect(disposal.isIncomplete).toBe(false)
  })
})
