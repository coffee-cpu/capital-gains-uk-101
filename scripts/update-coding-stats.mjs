#!/usr/bin/env node
/**
 * Refresh the About page's project stats (src/components/codingStats.json)
 * from the repository's GitHub commit history.
 *
 * Run at build time, not in the browser: the app makes no requests to GitHub
 * (its Content-Security-Policy would block them). The deploy workflow runs
 * this before `npm run build`, so each deploy shows current numbers. If
 * GitHub can't be reached, the committed file is kept and the build goes on.
 *
 * Usage: node scripts/update-coding-stats.mjs   (GITHUB_TOKEN optional, raises the rate limit)
 */
import { readFile, writeFile } from 'node:fs/promises'
import { getRepoStats } from 'vibe-coding-stats'

const OUTPUT = new URL('../src/components/codingStats.json', import.meta.url)
const REPO = 'coffee-cpu/capital-gains-uk-101'

try {
  const result = await getRepoStats(
    { repo: REPO },
    {
      excludeBots: true,
      excludeMergeCommits: true,
      sessionTimeoutMin: 45,
      ...(process.env.GITHUB_TOKEN && { githubToken: process.env.GITHUB_TOKEN }),
    }
  )
  const stats = {
    totalHours: Math.round(result.totals?.totalHours || 0),
    sessionsCount: result.totals?.sessionsCount || 0,
    devDays: result.totals?.devDays || 0,
    totalCommits: result.totals?.totalCommits || 0,
  }
  if (stats.totalCommits === 0) throw new Error('GitHub returned no commits')

  const before = await readFile(OUTPUT, 'utf8').catch(() => '')
  const after = JSON.stringify(stats, null, 2) + '\n'
  await writeFile(OUTPUT, after)
  console.log(before === after ? 'Coding stats unchanged' : `Coding stats updated: ${after.replace(/\s+/g, ' ').trim()}`)
} catch (error) {
  // Stats are nice to have: keep the committed numbers rather than fail the build
  console.warn(`Coding stats not refreshed, keeping the committed file: ${error instanceof Error ? error.message : error}`)
}
