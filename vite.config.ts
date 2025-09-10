import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

function devLogPlugin(): Plugin {
  const logDir = 'logs'
  const day = new Date().toISOString().slice(0,10).replace(/-/g,'')
  const reqLog = path.join(logDir, `vite-requests-${day}.log`)
  const errLog = path.join(logDir, `vite-errors-${day}.log`)
  try { fs.mkdirSync(logDir, { recursive: true }) } catch {}
  const append = (p: string, data: any) => {
    try { fs.appendFileSync(p, JSON.stringify(data) + '\n', 'utf8') } catch {}
  }
  return {
    name: 'dev-log',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        append(reqLog, { ts: new Date().toISOString(), method: req.method, url: req.url })
        next()
      })
      server.httpServer?.on('clientError', (err) => {
        append(errLog, { ts: new Date().toISOString(), type: 'clientError', msg: err?.message || String(err) })
      })
      server.ws.on('error', (err) => {
        append(errLog, { ts: new Date().toISOString(), type: 'wsError', msg: err?.message || String(err) })
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        append(reqLog, { ts: new Date().toISOString(), preview: true, method: req.method, url: req.url })
        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devLogPlugin()],
  assetsInclude: ['**/*.md', '**/*.jsonl', '**/*.ndjson'],
  server: {
    proxy: {
      '/log': {
        target: 'http://127.0.0.1:4317',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      input: 'index.html',
      external: [
        // Ensure Node-only scripts are never bundled
        'tools/log-server.mjs'
      ]
    }
  }
})
