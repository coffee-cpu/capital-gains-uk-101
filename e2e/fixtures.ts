import { test as base, expect, type Route } from '@playwright/test'

/**
 * Shared test fixture that keeps every spec off the network.
 *
 * The app fetches public reference data from a few hosts (see CONNECT_SOURCES
 * in vite.config.ts). Live responses change over time and make results depend
 * on the network, so each test's browser context answers them here instead:
 *
 * - cdn.jsdelivr.net stock split data: a year file with no splits. Specs that
 *   need splits register their own `page.route`, which takes precedence.
 * - HMRC exchange rate files (trade-tariff.service.gov.uk): 404, which is what
 *   the service returns for years and months it hasn't published. Rates up to
 *   the last bundled month come with the app, so specs don't need these.
 * - Any other external request is aborted and fails the test, so a new
 *   network dependency is noticed rather than silently hitting the internet.
 */

const SPLIT_DATA = /^https:\/\/cdn\.jsdelivr\.net\/gh\/coffee-cpu\/stock-splits-data@[^/]+\/data\/(\d{4})\.json$/
const HMRC_RATE_FILE = /^https:\/\/www\.trade-tariff\.service\.gov\.uk\/api\/v2\/exchange_rates\/files\//

function isExternal(url: URL): boolean {
  return url.protocol.startsWith('http') && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1'
}

export const test = base.extend({
  // The fixture callback is named `provide`, not Playwright's usual `use`,
  // so the React hooks lint rule doesn't mistake it for React's use()
  context: async ({ context }, provide) => {
    const unexpectedRequests: string[] = []
    await context.route(isExternal, (route: Route) => {
      const url = route.request().url()

      const split = SPLIT_DATA.exec(url)
      if (split) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ year: Number(split[1]), updated: '2024-01-01', splits: [] }),
        })
      }

      if (HMRC_RATE_FILE.test(url)) {
        return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Not Found"}' })
      }

      unexpectedRequests.push(url)
      return route.abort('blockedbyclient')
    })

    await provide(context)

    expect(
      unexpectedRequests,
      'External requests with no stub in e2e/fixtures.ts (add one, or route it in the spec)'
    ).toEqual([])
  },
})

export { expect }
export type { Page } from '@playwright/test'
