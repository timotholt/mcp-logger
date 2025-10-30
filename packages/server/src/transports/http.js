import http from 'http'
import fs from 'fs'
import path from 'path'
import { WebSocketServer } from 'ws'

function authorize(req, token) {
  if (!token) return true
  const header = req.headers['authorization'] || ''
  const value = Array.isArray(header) ? header[0] : header
  return value === `Bearer ${token}`
}

function serveStatic(req, res, dir) {
  if (!dir) return false
  const safeRoot = path.resolve(dir)
  const urlPath = req.url === '/' ? '/index.html' : req.url
  const normalizedPath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath
  const targetPath = path.resolve(safeRoot, normalizedPath)
  if (!targetPath.startsWith(safeRoot)) {
    return false
  }
  try {
    const stat = fs.statSync(targetPath)
    if (stat.isFile()) {
      const ext = path.extname(targetPath).toLowerCase()
      const contentType =
        {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.ico': 'image/x-icon'
        }[ext] || 'application/octet-stream'
      res.setHeader('Content-Type', contentType)
      const stream = fs.createReadStream(targetPath)
      stream.pipe(res)
      return true
    }
  } catch (err) {
    return false
  }
  return false
}

export function createHttpTransport({ config, store, broadcaster }) {
  if (!config.httpPort) {
    console.warn(
      '[mcp-logger] HTTP transport disabled: LOG_HTTP_PORT is not set or invalid. The dashboard and HTTP endpoints will be unavailable.'
    )
    return { start: async () => {}, stop: async () => {} }
  }

  const clients = new Set()
  let server
  let wss

  function broadcast(event, payload) {
    const message = JSON.stringify({ event, payload })
    clients.forEach((socket) => {
      try {
        socket.send(message)
      } catch (err) {
        clients.delete(socket)
      }
    })
  }

  broadcaster.on('append', (entry) => broadcast('append', entry))
  broadcaster.on('clear', (session) => broadcast('clear', session))
  broadcaster.on('session', (session) => broadcast('session', session))

  async function start() {
    server = http.createServer((req, res) => {
      if (!authorize(req, config.authToken)) {
        res.writeHead(401)
        res.end()
        return
      }

      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            ok: true,
            uptime: process.uptime(),
            entries: store.size ? store.size() : undefined
          })
        )
        return
      }

      if (req.method === 'POST' && req.url === '/push') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            const entry = store.append(payload)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: true, entry }))
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      if (req.method === 'GET' && req.url === '/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        })
        const { entries } = store.read({ cursor: 0, limit: 1000 })
        entries.forEach((entry) => {
          res.write(`event: append\n`)
          res.write(`data: ${JSON.stringify(entry)}\n\n`)
        })
        const unsubscribe = broadcaster.on('append', (entry) => {
          res.write(`event: append\n`)
          res.write(`data: ${JSON.stringify(entry)}\n\n`)
        })
        req.on('close', unsubscribe)
        return
      }

      if (serveStatic(req, res, config.dashboardDir)) {
        return
      }

      if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>MCP Logger</title>
    <style>
      body { font-family: sans-serif; margin: 2rem; line-height: 1.5; color: #111; }
      code { background: #f5f5f5; padding: 0.1rem 0.4rem; border-radius: 4px; }
      .hint { margin-top: 1rem; }
    </style>
  </head>
  <body>
    <h1>MCP Logger</h1>
    <p>Server is running.</p>
    <ul>
      <li><strong>Health:</strong> <code>/health</code></li>
      <li><strong>Push logs (POST JSON):</strong> <code>/push</code></li>
      <li><strong>Server events:</strong> <code>/events</code></li>
      <li><strong>WebSocket:</strong> <code>/ws</code></li>
    </ul>
    <div class="hint">
      ${
        config.dashboardDir
          ? 'Dashboard assets are being served from your configured directory.'
          : 'Dashboard is not built yet. Run <code>npm run build --prefix packages/dashboard</code> to generate the UI.'
      }
    </div>
  </body>
</html>`)
        return
      }

      res.writeHead(404)
      res.end()
    })

    await new Promise((resolve) => {
      server.listen(config.httpPort, config.httpHost || '0.0.0.0', resolve)
    })

    const address = server.address()
    if (address && typeof address === 'object') {
      const host = address.address === '::' ? 'localhost' : address.address
      console.log(
        `[mcp-logger] HTTP server listening at http://${host}:${address.port}`
      )
    } else {
      console.log('[mcp-logger] HTTP server listening (port %s)', config.httpPort)
    }

    wss = new WebSocketServer({ server, path: '/ws' })
    wss.on('connection', (socket, req) => {
      if (!authorize(req, config.authToken)) {
        socket.close()
        return
      }
      clients.add(socket)
      const { entries } = store.read({ cursor: 0, limit: 1000 })
      socket.send(JSON.stringify({ event: 'bootstrap', payload: entries }))
      socket.on('close', () => clients.delete(socket))
      socket.on('message', (data) => {
        try {
          const message = JSON.parse(data)
          if (message?.type === 'clear') {
            store.clear()
          }
          if (message?.type === 'session') {
            store.startSession(message.label)
          }
        } catch (err) {
          // ignore
        }
      })
    })
  }

  async function stop() {
    clients.forEach((socket) => socket.close())
    clients.clear()
    if (wss) {
      wss.close()
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
  }

  return { start, stop }
}
