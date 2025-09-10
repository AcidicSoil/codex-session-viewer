#!/usr/bin/env node
import { createServer } from 'http'
import { mkdirSync, appendFileSync, existsSync } from 'fs'
import { join } from 'path'

const PORT = Number(process.env.LOG_SERVER_PORT || 4317)
const HOST = process.env.LOG_SERVER_HOST || '127.0.0.1'
const LOG_DIR = process.env.LOG_DIR || 'logs'

if (!existsSync(LOG_DIR)) {
  try { mkdirSync(LOG_DIR, { recursive: true }) } catch {}
}

function logPathForNow() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return join(LOG_DIR, `watch-${y}${m}${day}.log`)
}

function write(line) {
  try { appendFileSync(logPathForNow(), line + '\n', 'utf8') } catch (e) { /* ignore */ }
}

function ok(res, body = { ok: true }) {
  res.writeHead(200, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  })
  res.end(JSON.stringify(body))
}

function bad(res, status = 400, body = { ok: false }) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  })
  res.end(JSON.stringify(body))
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
}

const server = createServer((req, res) => {
  const { method, url, headers } = req
  if (method === 'OPTIONS') {
    res.writeHead(204, { ...CORS })
    return res.end()
  }
  if (method === 'GET' && url?.startsWith('/ping')) return ok(res, { ok: true, ts: Date.now() })
  if (method === 'POST' && url?.startsWith('/log')) {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      try {
        const obj = JSON.parse(data || '{}')
        const line = JSON.stringify({ ts: new Date().toISOString(), ip: req.socket.remoteAddress, ua: headers['user-agent'], ...obj })
        write(line)
        ok(res)
      } catch {
        bad(res, 400)
      }
    })
    return
  }
  bad(res, 404)
})

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[watch-log] listening on http://${HOST}:${PORT} -> ${LOG_DIR}`)
})
