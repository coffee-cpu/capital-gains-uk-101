import { EnrichedTransaction } from '../../types/transaction'
import { MatchingResult, Section104Pool } from '../../types/cgt'

/**
 * Pipeline Pattern for CGT Matching Rules
 *
 * Each HMRC matching rule is implemented as a self-contained stage that
 * transforms the pipeline context. This enables:
 * - Single Responsibility: each matcher owns its stage implementation
 * - Open/Closed: new rules can be added without modifying the engine
 * - Dependency Inversion: engine depends on abstractions, not implementations
 */

/**
 * Context passed through the matching pipeline
 *
 * Accumulates state as each stage processes transactions
 */
export interface PipelineContext {
  /** Transactions being processed */
  transactions: EnrichedTransaction[]
  /** Accumulated matchings from all stages */
  matchings: MatchingResult[]
  /** Section 104 pools (populated by the final stage) */
  section104Pools: Map<string, Section104Pool>
}

/**
 * A single stage in the matching pipeline
 *
 * Each stage applies one HMRC matching rule and updates the context.
 * Stages should focus purely on matching logic.
 */
export interface MatchingStage {
  /** Human-readable name for debugging/logging */
  name: string
  /** Apply this stage's matching rule and return updated context */
  apply(context: PipelineContext): PipelineContext
}

/**
 * Create initial pipeline context from transactions
 */
export function createPipelineContext(
  transactions: EnrichedTransaction[]
): PipelineContext {
  return {
    transactions,
    matchings: [],
    section104Pools: new Map(),
  }
}

/**
 * Execute the matching pipeline
 *
 * Runs each stage in sequence, accumulating matchings.
 * The UI derives CGT rule badges directly from matchings,
 * so no transaction marking is needed.
 *
 * @param transactions Initial transactions to process
 * @param stages Pipeline stages to apply
 * @returns Final pipeline context with all matchings
 */
export function runMatchingPipeline(
  transactions: EnrichedTransaction[],
  stages: MatchingStage[]
): PipelineContext {
  return stages.reduce(
    (context, stage) => stage.apply(context),
    createPipelineContext(transactions)
  )
}
