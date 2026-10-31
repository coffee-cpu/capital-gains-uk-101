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
export default defineConfig({
  plugins: [react(), guidePages()],
  base: '/', // Custom domain - use root path
  server: {
    port: 3000,
  },
})
