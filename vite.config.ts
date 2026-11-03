import { defineConfig, createServer, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/** The parts of src/guides/index.ts used here (loaded through Vite, not imported) */
interface GuidesModule {
  buildGuideSite: () => { files: Map<string, string> }
}

const GUIDES_MODULE = '/src/guides/index.ts'

/**
 * Static guide pages (src/guides) and the sitemap, rendered to plain HTML so
 * search engines and AI agents can read them without running JavaScript.
 * The module is loaded with Vite's SSR loader, so it can use the app's
 * TypeScript sources (broker definitions) without a separate build step.
 */
function guidePages(): Plugin {
  return {
    name: 'guide-pages',
    async generateBundle() {
      const loader: ViteDevServer = await createServer({
        configFile: false,
        root: fileURLToPath(new URL('.', import.meta.url)),
        server: { middlewareMode: true, hmr: false },
        appType: 'custom',
        logLevel: 'error',
      })
      try {
        const guides = (await loader.ssrLoadModule(GUIDES_MODULE)) as GuidesModule
        guides.buildGuideSite().files.forEach((source, fileName) => {
          this.emitFile({ type: 'asset', fileName, source })
        })
      } finally {
        await loader.close()
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        if (!path.startsWith('/guides') && path !== '/sitemap.xml') return next()
        try {
          // Loaded on each request so edits to src/guides show without a restart
          const guides = (await server.ssrLoadModule(GUIDES_MODULE)) as GuidesModule
          const file = path === '/sitemap.xml' ? 'sitemap.xml' : `${path.slice(1).replace(/\/?$/, '/')}index.html`
          const source = guides.buildGuideSite().files.get(file)
          if (source === undefined) return next()
          res.setHeader('Content-Type', file.endsWith('.xml') ? 'application/xml' : 'text/html; charset=utf-8')
          res.end(source)
        } catch (error) {
          // Connect doesn't catch rejections from async middleware: hand the error to Vite
          next(error)
        }
      })
    },
  }
}

// https://vite.dev/config/
/**
 * Hosts the app fetches data from. Keep in sync with the privacy notice in
 * src/components/About.tsx and README.md (checked by
 * src/lib/__tests__/contentSecurityPolicy.test.ts).
 * - www.trade-tariff.service.gov.uk: HMRC monthly and yearly average exchange rates
 * - hmrc.matchilling.com: mirror of HMRC's monthly rates, fallback for months gov.uk can't supply
 * - api.frankfurter.dev: ECB daily exchange rates
 * - cdn.jsdelivr.net: stock split data
 */
export const CONNECT_SOURCES = [
  'https://hmrc.matchilling.com',
  'https://www.trade-tariff.service.gov.uk',
  'https://api.frankfurter.dev',
  'https://cdn.jsdelivr.net',
]

/**
 * Content-Security-Policy for the built app, as a <meta> tag (GitHub Pages
 * can't set headers). connect-src lists the only hosts the app may contact,
 * so the browser enforces that transaction data stays on the device even if
 * a dependency were compromised. Build only: the dev server injects inline
 * scripts (HMR, React refresh) that this policy would block.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // data: lets react-pdf load its WebAssembly layout engine, which is embedded
  // in the bundle as a data: URL (a local read; nothing leaves the device)
  `connect-src 'self' data: ${CONNECT_SOURCES.join(' ')}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      // Inserted right after the charset tag, which must stay first. Fail the
      // build if it's missing, rather than silently shipping without a CSP.
      const anchor = '<meta charset="UTF-8" />'
      if (!html.includes(anchor)) {
        throw new Error(`content-security-policy: "${anchor}" not found in index.html`)
      }
      return html.replace(
        anchor,
        `${anchor}\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), guidePages(), contentSecurityPolicy()],
  base: '/', // Custom domain - use root path
  server: {
    port: 3000,
  },
})
