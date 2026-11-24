import stats from './codingStats.json'

/**
 * Project stats from the repository's commit history. The numbers are
 * fetched at build time by scripts/update-coding-stats.mjs (the deploy
 * workflow runs it), so the browser makes no request to GitHub.
 */
export function CodingStats() {
  return (
    <section className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">Project Stats</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-brand-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-brand-600">{stats.totalHours}</div>
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
          className="text-brand-600 underline hover:text-brand-800"
        >
          GitHub commit history
        </a>
        {' '}using{' '}
        <a
          href="https://github.com/coffee-cpu/vibe-coding-stats"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 underline hover:text-brand-800"
        >
          vibe-coding-stats
        </a>
      </p>
    </section>
  )
}
