import { useEffect, useState } from 'react'
import { getRepoStats } from 'vibe-coding-stats'

interface RepoStats {
  totalHours: number
  sessionsCount: number
  devDays: number
  totalCommits: number
}

export function CodingStats() {
  const [stats, setStats] = useState<RepoStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true)
        const result = await getRepoStats(
          { repo: 'coffee-cpu/capital-gains-uk-101' },
          {
            excludeBots: true,
            excludeMergeCommits: true,
            sessionTimeoutMin: 45
          }
        )

        setStats({
          totalHours: Math.round(result.totals?.totalHours || 0),
          sessionsCount: result.totals?.sessionsCount || 0,
          devDays: result.totals?.devDays || 0,
          totalCommits: result.totals?.totalCommits || 0
        })
      } catch (err) {
        console.error('Failed to fetch coding stats:', err)
        setError('Failed to load coding statistics')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Development Statistics</h2>
        <div className="text-gray-600">Loading statistics...</div>
      </section>
    )
  }

  if (error || !stats) {
    return null // Silently fail - stats are nice to have but not critical
  }

  return (
    <section className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">Project Stats</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-600">{stats.totalHours}</div>
          <div className="text-xs text-gray-600 mt-0.5">Total Development Hours</div>
        </div>

        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-600">{stats.sessionsCount}</div>
          <div className="text-xs text-gray-600 mt-0.5">Coding Sessions</div>
        </div>

        <div className="bg-purple-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-purple-600">{stats.devDays}</div>
          <div className="text-xs text-gray-600 mt-0.5">Dev Days</div>
        </div>

        <div className="bg-orange-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-orange-600">{stats.totalCommits}</div>
          <div className="text-xs text-gray-600 mt-0.5">Total Commits</div>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Statistics generated from{' '}
        <a
          href="https://github.com/coffee-cpu/capital-gains-uk-101"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          GitHub commit history
        </a>
        {' '}using{' '}
        <a
          href="https://github.com/coffee-cpu/vibe-coding-stats"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          vibe-coding-stats
        </a>
      </p>
    </section>
  )
}
