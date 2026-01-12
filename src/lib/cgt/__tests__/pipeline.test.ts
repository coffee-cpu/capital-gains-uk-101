import { describe, it, expect } from 'vitest'
import {
  createPipelineContext,
  runMatchingPipeline,
  MatchingStage,
  PipelineContext,
} from '../pipeline'
import { EnrichedTransaction } from '../../../types/transaction'
import { MatchingResult, Section104Pool } from '../../../types/cgt'

describe('Pipeline', () => {
  // Helper function to create test transactions
  const createTransaction = (
    id: string,
    type: 'BUY' | 'SELL',
    symbol: string = 'AAPL',
    quantity: number = 10
  ): EnrichedTransaction => ({
    id,
    source: 'test',
    symbol,
    name: 'Apple Inc.',
    date: '2023-06-15',
    type,
    quantity,
    price: 180,
    currency: 'USD',
    total: 1800,
    fee: 5,
    notes: null,
    fx_rate: 1.27,
    price_gbp: 141.73,
    value_gbp: 1417.32,
    fee_gbp: 3.94,
    fx_source: 'HMRC',
    fx_error: null,
    tax_year: '2023/24',
    gain_group: 'NONE',
  })

  // Helper function to create a test matching
  const createMatching = (
    disposal: EnrichedTransaction,
    acquisition: EnrichedTransaction,
    rule: 'SAME_DAY' | '30_DAY' | 'SECTION_104' | 'SHORT_SELL',
    quantityMatched: number
  ): MatchingResult => ({
    disposal,
    acquisitions: [
      {
        transaction: acquisition,
        quantityMatched,
        costBasisGbp: acquisition.value_gbp ?? 0,
      },
    ],
    rule,
    quantityMatched,
    totalCostBasisGbp: acquisition.value_gbp ?? 0,
  })

  describe('createPipelineContext', () => {
    it('should create initial context with transactions', () => {
      const transactions = [
        createTransaction('tx-1', 'BUY'),
        createTransaction('tx-2', 'SELL'),
      ]

      const context = createPipelineContext(transactions)

      expect(context.transactions).toEqual(transactions)
      expect(context.matchings).toEqual([])
      expect(context.section104Pools).toBeInstanceOf(Map)
      expect(context.section104Pools.size).toBe(0)
    })

    it('should create context with empty transactions array', () => {
      const context = createPipelineContext([])

      expect(context.transactions).toEqual([])
      expect(context.matchings).toEqual([])
      expect(context.section104Pools.size).toBe(0)
    })

    it('should create context with multiple transactions', () => {
      const transactions = [
        createTransaction('tx-1', 'BUY', 'AAPL'),
        createTransaction('tx-2', 'SELL', 'AAPL'),
        createTransaction('tx-3', 'BUY', 'GOOGL'),
        createTransaction('tx-4', 'SELL', 'GOOGL'),
      ]

      const context = createPipelineContext(transactions)

      expect(context.transactions).toHaveLength(4)
      expect(context.matchings).toEqual([])
      expect(context.section104Pools.size).toBe(0)
    })

    it('should create fresh context instances each time', () => {
      const transactions = [createTransaction('tx-1', 'BUY')]

      const context1 = createPipelineContext(transactions)
      const context2 = createPipelineContext(transactions)

      // Should be different instances
      expect(context1).not.toBe(context2)
      expect(context1.matchings).not.toBe(context2.matchings)
      expect(context1.section104Pools).not.toBe(context2.section104Pools)

      // But contain the same transactions reference
      expect(context1.transactions).toBe(transactions)
      expect(context2.transactions).toBe(transactions)
    })
  })

  describe('runMatchingPipeline', () => {
    it('should return initial context when no stages provided', () => {
      const transactions = [
        createTransaction('tx-1', 'BUY'),
        createTransaction('tx-2', 'SELL'),
      ]

      const result = runMatchingPipeline(transactions, [])

      expect(result.transactions).toEqual(transactions)
      expect(result.matchings).toEqual([])
      expect(result.section104Pools.size).toBe(0)
    })

    it('should execute a single stage', () => {
      const transactions = [
        createTransaction('tx-1', 'BUY'),
        createTransaction('tx-2', 'SELL'),
      ]

      const mockStage: MatchingStage = {
        name: 'Mock Stage',
        apply: (context: PipelineContext) => {
          const matching = createMatching(
            transactions[1],
            transactions[0],
            'SAME_DAY',
            10
          )
          return {
            ...context,
            matchings: [...context.matchings, matching],
          }
        },
      }

      const result = runMatchingPipeline(transactions, [mockStage])

      expect(result.matchings).toHaveLength(1)
      expect(result.matchings[0].rule).toBe('SAME_DAY')
      expect(result.matchings[0].disposal.id).toBe('tx-2')
    })

    it('should execute multiple stages in sequence', () => {
      const transactions = [
        createTransaction('tx-1', 'BUY'),
        createTransaction('tx-2', 'SELL'),
        createTransaction('tx-3', 'BUY'),
      ]

      const stage1: MatchingStage = {
        name: 'Same Day Stage',
        apply: (context: PipelineContext) => {
          const matching = createMatching(
            transactions[1],
            transactions[0],
            'SAME_DAY',
            5
          )
          return {
            ...context,
            matchings: [...context.matchings, matching],
          }
        },
      }

      const stage2: MatchingStage = {
        name: 'Thirty Day Stage',
        apply: (context: PipelineContext) => {
          const matching = createMatching(
            transactions[1],
            transactions[2],
            '30_DAY',
            5
          )
          return {
            ...context,
            matchings: [...context.matchings, matching],
          }
        },
      }

      const result = runMatchingPipeline(transactions, [stage1, stage2])

      expect(result.matchings).toHaveLength(2)
      expect(result.matchings[0].rule).toBe('SAME_DAY')
      expect(result.matchings[1].rule).toBe('30_DAY')
    })

    it('should pass updated context between stages', () => {
      const transactions = [createTransaction('tx-1', 'BUY')]
      const executionOrder: string[] = []

      const stage1: MatchingStage = {
        name: 'Stage 1',
        apply: (context: PipelineContext) => {
          executionOrder.push('stage1')
          expect(context.matchings).toHaveLength(0)
          return {
            ...context,
            matchings: [
              createMatching(transactions[0], transactions[0], 'SAME_DAY', 10),
            ],
          }
        },
      }

      const stage2: MatchingStage = {
        name: 'Stage 2',
        apply: (context: PipelineContext) => {
          executionOrder.push('stage2')
          // Should see matching from stage1
          expect(context.matchings).toHaveLength(1)
          expect(context.matchings[0].rule).toBe('SAME_DAY')
          return {
            ...context,
            matchings: [
              ...context.matchings,
              createMatching(transactions[0], transactions[0], '30_DAY', 5),
            ],
          }
        },
      }

      const stage3: MatchingStage = {
        name: 'Stage 3',
        apply: (context: PipelineContext) => {
          executionOrder.push('stage3')
          // Should see matchings from stage1 and stage2
          expect(context.matchings).toHaveLength(2)
          expect(context.matchings[0].rule).toBe('SAME_DAY')
          expect(context.matchings[1].rule).toBe('30_DAY')
          return context
        },
      }

      runMatchingPipeline(transactions, [stage1, stage2, stage3])

      expect(executionOrder).toEqual(['stage1', 'stage2', 'stage3'])
    })

    it('should allow stages to modify section104Pools', () => {
      const transactions = [createTransaction('tx-1', 'BUY', 'AAPL')]

      const stage: MatchingStage = {
        name: 'Section 104 Stage',
        apply: (context: PipelineContext) => {
          const pool: Section104Pool = {
            symbol: 'AAPL',
            quantity: 10,
            totalCostGbp: 1417.32,
            averageCostGbp: 141.73,
            history: [
              {
                date: '2023-06-15',
                type: 'BUY',
                quantity: 10,
                costOrProceeds: 1417.32,
                balanceQuantity: 10,
                balanceCost: 1417.32,
                transactionId: 'tx-1',
              },
            ],
          }

          const updatedPools = new Map(context.section104Pools)
          updatedPools.set('AAPL', pool)

          return {
            ...context,
            section104Pools: updatedPools,
          }
        },
      }

      const result = runMatchingPipeline(transactions, [stage])

      expect(result.section104Pools.size).toBe(1)
      expect(result.section104Pools.has('AAPL')).toBe(true)
      expect(result.section104Pools.get('AAPL')?.quantity).toBe(10)
    })

    it('should handle empty transactions array', () => {
      const stage: MatchingStage = {
        name: 'Test Stage',
        apply: (context: PipelineContext) => {
          expect(context.transactions).toHaveLength(0)
          return context
        },
      }

      const result = runMatchingPipeline([], [stage])

      expect(result.transactions).toEqual([])
      expect(result.matchings).toEqual([])
    })

    it('should preserve original transactions throughout pipeline', () => {
      const transactions = [
        createTransaction('tx-1', 'BUY'),
        createTransaction('tx-2', 'SELL'),
      ]

      const stage1: MatchingStage = {
        name: 'Stage 1',
        apply: (context: PipelineContext) => {
          expect(context.transactions).toBe(transactions)
          return context
        },
      }

      const stage2: MatchingStage = {
        name: 'Stage 2',
        apply: (context: PipelineContext) => {
          expect(context.transactions).toBe(transactions)
          return context
        },
      }

      const result = runMatchingPipeline(transactions, [stage1, stage2])

      expect(result.transactions).toBe(transactions)
    })

    it('should handle stages that return empty matchings', () => {
      const transactions = [createTransaction('tx-1', 'BUY')]

      const noOpStage: MatchingStage = {
        name: 'No-Op Stage',
        apply: (context: PipelineContext) => context,
      }

      const result = runMatchingPipeline(transactions, [noOpStage])

      expect(result.matchings).toEqual([])
      expect(result.section104Pools.size).toBe(0)
    })

    it('should accumulate matchings from all stages', () => {
      const buy1 = createTransaction('buy-1', 'BUY', 'AAPL', 10)
      const buy2 = createTransaction('buy-2', 'BUY', 'AAPL', 5)
      const sell = createTransaction('sell-1', 'SELL', 'AAPL', 15)
      const transactions = [buy1, buy2, sell]

      const sameDayStage: MatchingStage = {
        name: 'Same Day',
        apply: (context: PipelineContext) => ({
          ...context,
          matchings: [
            ...context.matchings,
            createMatching(sell, buy1, 'SAME_DAY', 10),
          ],
        }),
      }

      const thirtyDayStage: MatchingStage = {
        name: 'Thirty Day',
        apply: (context: PipelineContext) => ({
          ...context,
          matchings: [
            ...context.matchings,
            createMatching(sell, buy2, '30_DAY', 5),
          ],
        }),
      }

      const result = runMatchingPipeline(transactions, [
        sameDayStage,
        thirtyDayStage,
      ])

      expect(result.matchings).toHaveLength(2)
      expect(result.matchings[0].rule).toBe('SAME_DAY')
      expect(result.matchings[0].quantityMatched).toBe(10)
      expect(result.matchings[1].rule).toBe('30_DAY')
      expect(result.matchings[1].quantityMatched).toBe(5)
    })

    it('should support complex multi-stage pipeline with pools', () => {
      const transactions = [
        createTransaction('tx-1', 'BUY', 'AAPL', 100),
        createTransaction('tx-2', 'BUY', 'GOOGL', 50),
        createTransaction('tx-3', 'SELL', 'AAPL', 20),
      ]

      let stageExecutionCount = 0

      const stage1: MatchingStage = {
        name: 'Same Day Matching',
        apply: (context: PipelineContext) => {
          stageExecutionCount++
          return {
            ...context,
            matchings: [
              createMatching(transactions[2], transactions[0], 'SAME_DAY', 20),
            ],
          }
        },
      }

      const stage2: MatchingStage = {
        name: 'Build Section 104 Pools',
        apply: (context: PipelineContext) => {
          stageExecutionCount++
          const pools = new Map<string, Section104Pool>()

          // Pool for remaining AAPL after same-day matching
          pools.set('AAPL', {
            symbol: 'AAPL',
            quantity: 80,
            totalCostGbp: 1133.86,
            averageCostGbp: 14.17,
            history: [
              {
                date: '2023-06-15',
                type: 'BUY',
                quantity: 100,
                costOrProceeds: 1417.32,
                balanceQuantity: 100,
                balanceCost: 1417.32,
                transactionId: 'tx-1',
              },
              {
                date: '2023-06-15',
                type: 'SELL',
                quantity: 20,
                costOrProceeds: 283.46,
                balanceQuantity: 80,
                balanceCost: 1133.86,
                transactionId: 'tx-3',
              },
            ],
          })

          // Pool for GOOGL (no matching yet)
          pools.set('GOOGL', {
            symbol: 'GOOGL',
            quantity: 50,
            totalCostGbp: 708.66,
            averageCostGbp: 14.17,
            history: [
              {
                date: '2023-06-15',
                type: 'BUY',
                quantity: 50,
                costOrProceeds: 708.66,
                balanceQuantity: 50,
                balanceCost: 708.66,
                transactionId: 'tx-2',
              },
            ],
          })

          return {
            ...context,
            section104Pools: pools,
          }
        },
      }

      const result = runMatchingPipeline(transactions, [stage1, stage2])

      expect(stageExecutionCount).toBe(2)
      expect(result.matchings).toHaveLength(1)
      expect(result.matchings[0].rule).toBe('SAME_DAY')
      expect(result.section104Pools.size).toBe(2)
      expect(result.section104Pools.get('AAPL')?.quantity).toBe(80)
      expect(result.section104Pools.get('GOOGL')?.quantity).toBe(50)
    })

    it('should maintain stage independence - stages should not mutate input context', () => {
      const transactions = [createTransaction('tx-1', 'BUY')]

      const stage1: MatchingStage = {
        name: 'Stage 1',
        apply: (context: PipelineContext) => {
          const newMatching = createMatching(
            transactions[0],
            transactions[0],
            'SAME_DAY',
            10
          )
          // Create new context instead of mutating
          return {
            ...context,
            matchings: [...context.matchings, newMatching],
          }
        },
      }

      const stage2: MatchingStage = {
        name: 'Stage 2',
        apply: (context: PipelineContext) => {
          // Should receive the updated context from stage1
          expect(context.matchings).toHaveLength(1)
          return context
        },
      }

      runMatchingPipeline(transactions, [stage1, stage2])
    })

    it('should handle stage with only section104Pool updates and no matchings', () => {
      const transactions = [createTransaction('tx-1', 'BUY', 'AAPL')]

      const poolOnlyStage: MatchingStage = {
        name: 'Pool Only Stage',
        apply: (context: PipelineContext) => {
          const pools = new Map<string, Section104Pool>()
          pools.set('AAPL', {
            symbol: 'AAPL',
            quantity: 10,
            totalCostGbp: 1417.32,
            averageCostGbp: 141.73,
            history: [],
          })
          return {
            ...context,
            section104Pools: pools,
          }
        },
      }

      const result = runMatchingPipeline(transactions, [poolOnlyStage])

      expect(result.matchings).toHaveLength(0)
      expect(result.section104Pools.size).toBe(1)
      expect(result.section104Pools.get('AAPL')).toBeDefined()
    })

    it('should allow later stages to override earlier stage results', () => {
      const transactions = [createTransaction('tx-1', 'BUY')]

      const stage1: MatchingStage = {
        name: 'Initial Stage',
        apply: (context: PipelineContext) => {
          const pools = new Map<string, Section104Pool>()
          pools.set('AAPL', {
            symbol: 'AAPL',
            quantity: 10,
            totalCostGbp: 100,
            averageCostGbp: 10,
            history: [],
          })
          return { ...context, section104Pools: pools }
        },
      }

      const stage2: MatchingStage = {
        name: 'Override Stage',
        apply: (context: PipelineContext) => {
          const pools = new Map<string, Section104Pool>()
          pools.set('AAPL', {
            symbol: 'AAPL',
            quantity: 20, // Updated
            totalCostGbp: 200, // Updated
            averageCostGbp: 10,
            history: [],
          })
          return { ...context, section104Pools: pools }
        },
      }

      const result = runMatchingPipeline(transactions, [stage1, stage2])

      expect(result.section104Pools.get('AAPL')?.quantity).toBe(20)
      expect(result.section104Pools.get('AAPL')?.totalCostGbp).toBe(200)
    })
  })
})
