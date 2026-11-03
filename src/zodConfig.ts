import { z } from 'zod'

/**
 * Run Zod without its eval-based fast path. Zod probes for `new Function`
 * support on first use; the site's Content-Security-Policy blocks eval, so the
 * probe would fail and log a policy violation on every load. Imported first in
 * main.tsx so it applies before any schema is used.
 */
z.config({ jitless: true })
