import { describe, it, expect } from 'vitest'
import { normalizeSchwabTransactions } from '../../parsers/schwab'
import { calculateCGT } from '../engine'
import { EnrichedTransaction } from '../../../types/transaction'

describe('Options Short Sell', () => {
  it('should calculate gain for sell-to-open followed by expiration', () => {
    // Simulate the CSV rows for options
    const rows = [
      {
        Date: '08/18/2025',
        Action: 'Sell to Open',
        Symbol: 'APP 08/22/2025 475.00 C',
        Description: 'CALL APPLOVIN CORP $475 EXP 08/22/25',
        Quantity: '4',
        Price: '$1.10',
        'Fees & Comm': '$2.65',
        Amount: '$437.35'
      },
      {
        Date: '08/25/2025 as of 08/22/2025',
        Action: 'Expired',
        Symbol: 'APP 08/22/2025 475.00 C',
        Description: 'CALL APPLOVIN CORP $475 EXP 08/22/25',
        Quantity: '4',
        Price: '',
        'Fees & Comm': '',
        Amount: ''
      }
    ]

    const transactions = normalizeSchwabTransactions(rows, 'test')

    console.log('=== Parsed Transactions ===')
    transactions.forEach(tx => {
      console.log(`${tx.type}: qty=${tx.quantity}, price=${tx.price}, total=${tx.total}, fee=${tx.fee}`)
    })

    // Verify parsing
    expect(transactions).toHaveLength(2)
    expect(transactions[0].type).toBe('OPTIONS_SELL_TO_OPEN')
    expect(transactions[0].quantity).toBe(4)
    expect(transactions[0].price).toBe(1.10)
    expect(transactions[1].type).toBe('OPTIONS_EXPIRED')
    expect(transactions[1].quantity).toBe(4)

    // Enrich transactions (use FX rate = 1 for simplicity - pretend USD = GBP)
    const enriched: EnrichedTransaction[] = transactions.map(tx => ({
      ...tx,
      fx_rate: 1,
      price_gbp: tx.price,
      value_gbp: tx.total,
      fee_gbp: tx.fee,
      fx_source: 'test',
      tax_year: '2025/26',
      gain_group: 'NONE' as const,
    }))

    console.log('\n=== Enriched Transactions ===')
    enriched.forEach(tx => {
      console.log(`${tx.type}: qty=${tx.quantity}, price_gbp=${tx.price_gbp}, value_gbp=${tx.value_gbp}, fee_gbp=${tx.fee_gbp}`)
    })

    const result = calculateCGT(enriched)

    console.log('\n=== CGT Results ===')
    console.log('Disposals:', result.disposals.length)
    result.disposals.forEach(d => {
      console.log(`  ${d.disposal.symbol}: proceeds=${d.proceedsGbp.toFixed(2)}, costs=${d.allowableCostsGbp.toFixed(2)}, gain=${d.gainOrLossGbp.toFixed(2)}`)
      console.log(`  Rule: ${d.matchings[0]?.rule}`)
    })
    console.log('\nTransaction gain_groups:')
    result.transactions.forEach(tx => {
      console.log(`  ${tx.type}: gain_group=${tx.gain_group}`)
    })

    // Verify the matching worked
    expect(result.disposals.length).toBe(1)

    // The sell-to-open should be matched with the expired as SHORT_SELL
    const disposal = result.disposals[0]
    expect(disposal.matchings[0]?.rule).toBe('SHORT_SELL')

    // Expected gain calculation:
    // Price per share: $1.10
    // Quantity: 4 contracts
    // Contract size: 100 shares per contract
    // Gross proceeds: 4 * $1.10 * 100 = $440.00
    // Fees: $2.65 (spread across 400 effective shares = $0.006625/share)
    // Net proceeds: $440.00 - $2.65 = $437.35
    // Cost basis: $0 (expired worthless)
    // Expected gain: $437.35

    console.log('\n=== Detailed disposal info ===')
    console.log('Disposal quantity:', disposal.disposal.quantity)
    console.log('Disposal contract_size:', disposal.disposal.contract_size)
    console.log('Disposal price_gbp:', disposal.disposal.price_gbp)
    console.log('Disposal fee_gbp:', disposal.disposal.fee_gbp)
    console.log('Proceeds GBP:', disposal.proceedsGbp)
    console.log('Allowable costs GBP:', disposal.allowableCostsGbp)
    console.log('Gain/Loss GBP:', disposal.gainOrLossGbp)

    // The proceeds should be calculated as: price * quantity * contract_size - fees
    // = $1.10 * 4 * 100 - $2.65 = $437.35
    expect(disposal.proceedsGbp).toBeCloseTo(437.35, 2)
    expect(disposal.allowableCostsGbp).toBe(0)
    expect(disposal.gainOrLossGbp).toBeCloseTo(437.35, 2)
  })

  it('should handle covered call assignment (DELL scenario)', () => {
    // Scenario: Covered Call Assignment
    // 1. Buy 500 DELL shares at $135.053 = $67,526.50
    // 2. Sell to Open 5 call options at $0.30 = $146.69 premium
    // 3. Options Assigned (calls exercised against you)
    // 4. Sell 500 DELL shares at $125.00 = $62,499.92
    //
    // CGT Treatment:
    // - Options: Sell to Open ($146.69) matched with Assigned ($0) = $146.69 gain
    // - Shares: Sell 500 @ $125 matched with Buy 500 @ $135.053
    //   Proceeds: $62,499.92, Cost: $67,526.50, Loss: -$5,026.58

    const rows = [
      {
        Date: '04/04/2024',
        Action: 'Buy',
        Symbol: 'DELL',
        Description: 'DELL TECHNOLOGIES INC CLASS C',
        Quantity: '500',
        Price: '$135.053',
        'Fees & Comm': '',
        Amount: '-$67526.50'
      },
      {
        Date: '07/02/2025',
        Action: 'Sell to Open',
        Symbol: 'DELL 07/03/2025 125.00 C',
        Description: 'CALL DELL TECHNOLOGIES I$125 EXP 07/03/25',
        Quantity: '5',
        Price: '$0.30',
        'Fees & Comm': '$3.31',
        Amount: '$146.69'
      },
      {
        Date: '07/07/2025 as of 07/03/2025',
        Action: 'Assigned',
        Symbol: 'DELL 07/03/2025 125.00 C',
        Description: 'CALL DELL TECHNOLOGIES I$125 EXP 07/03/25',
        Quantity: '5',
        Price: '',
        'Fees & Comm': '',
        Amount: ''
      },
      {
        Date: '07/07/2025 as of 07/03/2025',
        Action: 'Sell',
        Symbol: 'DELL',
        Description: 'DELL TECHNOLOGIES INC CLASS C',
        Quantity: '500',
        Price: '$125.00',
        'Fees & Comm': '$0.08',
        Amount: '$62499.92'
      }
    ]

    const transactions = normalizeSchwabTransactions(rows, 'test-dell')

    console.log('\n=== Parsed Transactions (DELL Covered Call) ===')
    transactions.forEach(tx => {
      console.log(`${tx.type}: symbol=${tx.symbol}, qty=${tx.quantity}, price=${tx.price}, total=${tx.total}`)
    })

    // Enrich transactions
    const enriched: EnrichedTransaction[] = transactions.map(tx => ({
      ...tx,
      fx_rate: 1,
      price_gbp: tx.price,
      value_gbp: tx.total,
      fee_gbp: tx.fee,
      fx_source: 'test',
      tax_year: tx.date.startsWith('2024') ? '2024/25' : '2025/26',
      gain_group: 'NONE' as const,
    }))

    const result = calculateCGT(enriched)

    console.log('\n=== CGT Results (DELL) ===')
    console.log('Number of disposals:', result.disposals.length)
    result.disposals.forEach((d, i) => {
      console.log(`\nDisposal ${i + 1}: ${d.disposal.symbol}`)
      console.log(`  Type: ${d.disposal.type}`)
      console.log(`  Quantity: ${d.disposal.quantity}`)
      console.log(`  Proceeds: ${d.proceedsGbp.toFixed(2)}`)
      console.log(`  Costs: ${d.allowableCostsGbp.toFixed(2)}`)
      console.log(`  Gain/Loss: ${d.gainOrLossGbp.toFixed(2)}`)
      console.log(`  Rules: ${d.matchings.map(m => m.rule).join(', ')}`)
    })

    console.log('\n=== Transaction gain_groups ===')
    result.transactions.forEach(tx => {
      console.log(`  ${tx.type} (${tx.symbol}): gain_group=${tx.gain_group}`)
    })

    // Should have 2 disposals: options + stock
    expect(result.disposals.length).toBe(2)

    // Find the options disposal
    const optionsDisposal = result.disposals.find(d => d.disposal.symbol.includes('DELL 07/03/2025'))
    expect(optionsDisposal).toBeDefined()
    expect(optionsDisposal!.matchings[0]?.rule).toBe('SHORT_SELL')
    expect(optionsDisposal!.proceedsGbp).toBeCloseTo(146.69, 2)
    expect(optionsDisposal!.allowableCostsGbp).toBe(0)
    expect(optionsDisposal!.gainOrLossGbp).toBeCloseTo(146.69, 2)

    // Find the stock disposal
    const stockDisposal = result.disposals.find(d => d.disposal.symbol === 'DELL')
    expect(stockDisposal).toBeDefined()

    // Stock should be matched via Section 104 (BUY was in 2024, SELL in 2025)
    console.log('\n=== Stock Disposal Details ===')
    console.log('Stock proceeds:', stockDisposal!.proceedsGbp)
    console.log('Stock costs:', stockDisposal!.allowableCostsGbp)
    console.log('Stock gain:', stockDisposal!.gainOrLossGbp)
    console.log('Stock rules:', stockDisposal!.matchings.map(m => m.rule))

    // Expected:
    // Proceeds: $62,499.92 - $0.08 fees = $62,499.84
    // Cost: $67,526.50 (from Buy)
    // Loss: $62,499.84 - $67,526.50 = -$5,026.66
    expect(stockDisposal!.proceedsGbp).toBeCloseTo(62499.84, 0)
    expect(stockDisposal!.allowableCostsGbp).toBeCloseTo(67526.50, 0)
    expect(stockDisposal!.gainOrLossGbp).toBeCloseTo(-5026.66, 0)
  })

  it('should handle cash-secured put assignment (RKLB scenario)', () => {
    // Scenario: Cash-Secured Put Assignment
    // 1. Sell to Open 10 put options at $0.55 = $543.35 premium
    // 2. Options Assigned (puts exercised against you)
    // 3. Buy 1,000 RKLB shares at $27.00 = $27,000.00 (assignment forces you to buy)
    //
    // CGT Treatment:
    // - Options: Sell to Open ($543.35) matched with Assigned ($0) = $543.35 gain
    // - Shares: The BUY is an acquisition, not a disposal - no CGT event yet
    //   The shares go into Section 104 pool for future disposal

    const rows = [
      {
        Date: '06/12/2025',
        Action: 'Sell to Open',
        Symbol: 'RKLB 06/13/2025 27.00 P',
        Description: 'PUT ROCKET LAB CORP $27 EXP 06/13/25',
        Quantity: '10',
        Price: '$0.55',
        'Fees & Comm': '$6.65',
        Amount: '$543.35'
      },
      {
        Date: '06/16/2025 as of 06/13/2025',
        Action: 'Assigned',
        Symbol: 'RKLB 06/13/2025 27.00 P',
        Description: 'PUT ROCKET LAB CORP $27 EXP 06/13/25',
        Quantity: '10',
        Price: '',
        'Fees & Comm': '',
        Amount: ''
      },
      {
        Date: '06/16/2025 as of 06/13/2025',
        Action: 'Buy',
        Symbol: 'RKLB',
        Description: 'ROCKET LAB CORP',
        Quantity: '1,000',
        Price: '$27.00',
        'Fees & Comm': '',
        Amount: '-$27000.00'
      }
    ]

    const transactions = normalizeSchwabTransactions(rows, 'test-rklb')

    console.log('\n=== Parsed Transactions (RKLB Cash-Secured Put) ===')
    transactions.forEach(tx => {
      console.log(`${tx.type}: symbol=${tx.symbol}, qty=${tx.quantity}, price=${tx.price}, total=${tx.total}`)
    })

    // Enrich transactions
    const enriched: EnrichedTransaction[] = transactions.map(tx => ({
      ...tx,
      fx_rate: 1,
      price_gbp: tx.price,
      value_gbp: tx.total,
      fee_gbp: tx.fee,
      fx_source: 'test',
      tax_year: '2025/26',
      gain_group: 'NONE' as const,
    }))

    const result = calculateCGT(enriched)

    console.log('\n=== CGT Results (RKLB) ===')
    console.log('Number of disposals:', result.disposals.length)
    result.disposals.forEach((d, i) => {
      console.log(`\nDisposal ${i + 1}: ${d.disposal.symbol}`)
      console.log(`  Type: ${d.disposal.type}`)
      console.log(`  Quantity: ${d.disposal.quantity}`)
      console.log(`  Proceeds: ${d.proceedsGbp.toFixed(2)}`)
      console.log(`  Costs: ${d.allowableCostsGbp.toFixed(2)}`)
      console.log(`  Gain/Loss: ${d.gainOrLossGbp.toFixed(2)}`)
      console.log(`  Rules: ${d.matchings.map(m => m.rule).join(', ')}`)
    })

    console.log('\n=== Transaction gain_groups ===')
    result.transactions.forEach(tx => {
      console.log(`  ${tx.type} (${tx.symbol}): gain_group=${tx.gain_group}`)
    })

    console.log('\n=== Section 104 Pools ===')
    for (const [symbol, pool] of result.section104Pools) {
      console.log(`${symbol}: qty=${pool.quantity}, cost=${pool.totalCostGbp.toFixed(2)}, avg=${pool.averageCostGbp.toFixed(2)}`)
    }

    // Should have only 1 disposal (options) - the stock BUY is an acquisition
    expect(result.disposals.length).toBe(1)

    // Verify options disposal
    const optionsDisposal = result.disposals[0]
    expect(optionsDisposal.disposal.symbol).toBe('RKLB 06/13/2025 27.00 P')
    expect(optionsDisposal.matchings[0]?.rule).toBe('SHORT_SELL')
    expect(optionsDisposal.proceedsGbp).toBeCloseTo(543.35, 2)
    expect(optionsDisposal.allowableCostsGbp).toBe(0)
    expect(optionsDisposal.gainOrLossGbp).toBeCloseTo(543.35, 2)

    // Verify RKLB shares are in Section 104 pool
    const rklbPool = result.section104Pools.get('RKLB')
    expect(rklbPool).toBeDefined()
    expect(rklbPool!.quantity).toBe(1000)
    expect(rklbPool!.totalCostGbp).toBeCloseTo(27000, 0)
  })

  it('should handle sell-to-open followed by buy-to-close (SMCI scenario)', () => {
    // Scenario: Sell to Open then Buy to Close
    // This tests the classic options short selling pattern where you:
    // 1. Sell to Open (collect premium) - DISPOSAL
    // 2. Buy to Close (pay to exit) - ACQUISITION
    //
    // SMCI 1010.00 C:
    // - 03/18/2024 Sell to Open: $5,549.30 premium
    // - 03/19/2024 Buy to Close: -$600.66 cost
    // - Gain: $5,549.30 - $600.66 = $4,948.64
    //
    // SMCI 1200.00 C (same day):
    // - 03/18/2024 Sell to Open: $4,149.31 premium
    // - 03/18/2024 Buy to Close: -$950.66 cost
    // - Gain: $4,149.31 - $950.66 = $3,198.65

    const rows = [
      {
        Date: '03/18/2024',
        Action: 'Sell to Open',
        Symbol: 'SMCI 03/22/2024 1010.00 C',
        Description: 'CALL SUPER MICRO COMPUTE$1010 EXP 03/22/24',
        Quantity: '1',
        Price: '$55.50',
        'Fees & Comm': '$0.70',
        Amount: '$5549.30'
      },
      {
        Date: '03/18/2024',
        Action: 'Sell to Open',
        Symbol: 'SMCI 03/22/2024 1200.00 C',
        Description: 'CALL SUPER MICRO COMPUTE$1200 EXP 03/22/24',
        Quantity: '1',
        Price: '$41.50',
        'Fees & Comm': '$0.69',
        Amount: '$4149.31'
      },
      {
        Date: '03/18/2024',
        Action: 'Buy to Close',
        Symbol: 'SMCI 03/22/2024 1200.00 C',
        Description: 'CALL SUPER MICRO COMPUTE$1200 EXP 03/22/24',
        Quantity: '1',
        Price: '$9.50',
        'Fees & Comm': '$0.66',
        Amount: '-$950.66'
      },
      {
        Date: '03/19/2024',
        Action: 'Buy to Close',
        Symbol: 'SMCI 03/22/2024 1010.00 C',
        Description: 'CALL SUPER MICRO COMPUTE$1010 EXP 03/22/24',
        Quantity: '1',
        Price: '$6.00',
        'Fees & Comm': '$0.66',
        Amount: '-$600.66'
      }
    ]

    const transactions = normalizeSchwabTransactions(rows, 'test-smci')

    console.log('\n=== Parsed Transactions (SMCI Buy to Close) ===')
    transactions.forEach(tx => {
      console.log(`${tx.type}: symbol=${tx.symbol}, qty=${tx.quantity}, price=${tx.price}, total=${tx.total}, fee=${tx.fee}`)
    })

    // Verify parsing
    expect(transactions).toHaveLength(4)
    expect(transactions[0].type).toBe('OPTIONS_SELL_TO_OPEN')
    expect(transactions[1].type).toBe('OPTIONS_SELL_TO_OPEN')
    expect(transactions[2].type).toBe('OPTIONS_BUY_TO_CLOSE')
    expect(transactions[3].type).toBe('OPTIONS_BUY_TO_CLOSE')

    // Enrich transactions
    const enriched: EnrichedTransaction[] = transactions.map(tx => ({
      ...tx,
      fx_rate: 1,
      price_gbp: tx.price,
      value_gbp: tx.total ? Math.abs(tx.total) : null,
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

    console.log('\n=== CGT Results (SMCI) ===')
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

    // Should have 2 disposals (one for each Sell to Open)
    expect(result.disposals.length).toBe(2)

    // Find the 1200.00 C disposal (same-day scenario)
    const smci1200Disposal = result.disposals.find(d => d.disposal.symbol.includes('1200.00'))
    expect(smci1200Disposal).toBeDefined()
    console.log('\n=== SMCI 1200.00 C Details ===')
    console.log('Proceeds:', smci1200Disposal!.proceedsGbp)
    console.log('Costs:', smci1200Disposal!.allowableCostsGbp)
    console.log('Gain:', smci1200Disposal!.gainOrLossGbp)
    console.log('Rule:', smci1200Disposal!.matchings[0]?.rule)

    // Expected: Proceeds $4,149.31, Cost $950.66, Gain $3,198.65
    // Note: Same-day Sell to Open + Buy to Close on 03/18 should match
    expect(smci1200Disposal!.proceedsGbp).toBeCloseTo(4149.31, 0)
    expect(smci1200Disposal!.allowableCostsGbp).toBeCloseTo(950.66, 0)
    expect(smci1200Disposal!.gainOrLossGbp).toBeCloseTo(3198.65, 0)

    // Find the 1010.00 C disposal (next-day close)
    const smci1010Disposal = result.disposals.find(d => d.disposal.symbol.includes('1010.00'))
    expect(smci1010Disposal).toBeDefined()
    console.log('\n=== SMCI 1010.00 C Details ===')
    console.log('Proceeds:', smci1010Disposal!.proceedsGbp)
    console.log('Costs:', smci1010Disposal!.allowableCostsGbp)
    console.log('Gain:', smci1010Disposal!.gainOrLossGbp)
    console.log('Rule:', smci1010Disposal!.matchings[0]?.rule)

    // Expected: Proceeds $5,549.30, Cost $600.66, Gain $4,948.64
    // Short sell rule: Sell to Open on 03/18, Buy to Close on 03/19
    expect(smci1010Disposal!.proceedsGbp).toBeCloseTo(5549.30, 0)
    expect(smci1010Disposal!.allowableCostsGbp).toBeCloseTo(600.66, 0)
    expect(smci1010Disposal!.gainOrLossGbp).toBeCloseTo(4948.64, 0)
  })
})
