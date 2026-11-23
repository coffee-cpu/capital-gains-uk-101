/**
 * How far apart two records of the same stock split can be and still count
 * as one split. Brokers and split data sources may record a split a few days
 * apart (ex-date vs pay or effective date).
 */
export const SPLIT_MATCH_WINDOW_DAYS = 7

const SPLIT_MATCH_WINDOW_MS = SPLIT_MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000

/** Whether two ISO dates (YYYY-MM-DD) are within the split match window of each other */
export function withinSplitWindow(a: string, b: string): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= SPLIT_MATCH_WINDOW_MS
}
