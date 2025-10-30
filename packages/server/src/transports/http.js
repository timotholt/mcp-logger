import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
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

export function createHttpTransport({ config, store, broadcaster, meta = {} }) {
  if (!config.httpPort) {
    console.warn(
      '[mcp-logger] HTTP transport disabled: LOG_HTTP_PORT is not set or invalid. The dashboard and HTTP endpoints will be unavailable.'
    )
    return { start: async () => {}, stop: async () => {} }
  }

  const clients = new Set()
  let server
  let wss

  const demoAuthHeaderLine = config.authToken
    ? `    xhr.setRequestHeader('Authorization', 'Bearer ${config.authToken
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")}');`
    : ''

  const demoScriptLines = [
    'console.log("DEMO: Script executing...");',
    '(function() {',
    '  console.log("DEMO: Inside IIFE");',
    "  var endpoint = window.location.origin + '/push';",
    "  var clientId = 'demo-browser';",
    "  var sessionId = 'demo-session';",
    '  var intervalMs = 3000;',
    '  var counter = 0;',
    '  var timer = null;',
    "  var output = document.getElementById('output');",
    "  var toggle = document.getElementById('toggle');",
    '  var newline = String.fromCharCode(10);',
    '  console.log("DEMO: Script loaded, endpoint: " + endpoint);',
    '  function zeroPad(value) {',
    "    return value < 10 ? '0' + value : '' + value;",
    '  }',
    '  function timestamp() {',
    '    var now = new Date();',
    "    return zeroPad(now.getMonth() + 1) + '/' + zeroPad(now.getDate()) + '/' + now.getFullYear() + ' ' + zeroPad(now.getHours()) + ':' + zeroPad(now.getMinutes()) + ':' + zeroPad(now.getSeconds());",
    '  }',
    '  function randomSixDigits() {',
    "    return ('000000' + Math.floor(Math.random() * 1000000)).slice(-6);",
    '  }',
    '  function log(message) {',
    '    output.textContent = message + newline + output.textContent;',
    '  }',
    '  function sendLog() {',
    '    counter += 1;',
    '    console.log("Sending log #" + counter);',
    "    var message = 'Random message ' + randomSixDigits() + ' sent at ' + timestamp();",
    '    var payload = JSON.stringify({',
    "      level: 'info',",
    '      message: message,',
    '      clientId: clientId,',
    '      sessionId: sessionId,',
    "      timestamp: new Date().toISOString()",
    '    });',
    '    var xhr = new XMLHttpRequest();',
    "    xhr.open('POST', endpoint, true);",
    "    xhr.setRequestHeader('Content-Type', 'application/json');",
    demoAuthHeaderLine,
    '    xhr.onreadystatechange = function() {',
    '      if (xhr.readyState === 4) {',
    '        console.log("XHR readyState 4, status: " + xhr.status);',
    '        if (xhr.status >= 200 && xhr.status < 300) {',
    "          log('#' + counter + ' status ' + xhr.status + ': ' + message);",
    '        } else {',
    "          log('#' + counter + ' failed (status ' + xhr.status + ')');",
    '        }',
    '      }',
    '    };',
    '    xhr.onerror = function() {',
    "      console.log('XHR error');",
    "      log('#' + counter + ' network error');",
    '    };',
    '    xhr.send(payload);',
    '  }',
    '  function start() {',
    '    if (timer) { return; }',
    "    console.log('Demo starting...');",
    "    log('Demo started at ' + timestamp() + ' - endpoint: ' + endpoint);",
    '    sendLog();',
    '    timer = window.setInterval(sendLog, intervalMs);',
    "    toggle.textContent = 'Stop demo';",
    '  }',
    '  function stop() {',
    '    if (!timer) { return; }',
    '    window.clearInterval(timer);',
    '    timer = null;',
    "    log('Demo paused at ' + timestamp());",
    "    toggle.textContent = 'Start demo';",
    '  }',
    '  toggle.onclick = function() {',
    '    if (timer) {',
    '      stop();',
    '    } else {',
    '      start();',
    '    }',
    '  };',
    '  start();',
    '})();'
  ]
  
  const demoScript = demoScriptLines.filter(line => line !== '').join('\n')

  const demoPageHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>MCP Logger Demo</title>
    <style>
      body { font-family: sans-serif; background: #101620; color: #f5f5f5; margin: 0; padding: 24px; }
      h1 { font-size: 1.5rem; margin-bottom: 0.2rem; }
      p { margin-top: 0; }
      button { background: #3b82f6; border: none; color: #fff; padding: 8px 14px; font-size: 0.95rem; cursor: pointer; border-radius: 4px; }
      button:disabled { opacity: 0.6; cursor: default; }
      pre { background: rgba(0,0,0,0.4); padding: 12px; border-radius: 6px; max-height: 300px; overflow-y: auto; font-size: 0.85rem; }
    </style>
  </head>
  <body>
    <h1>MCP Logger Browser Demo</h1>
    <p>This page sends an info log every 3 seconds using old-school JavaScript APIs.</p>
    <button id="toggle">Stop demo</button>
    <pre id="output">Preparing demo...</pre>
    <script type="text/javascript">
${demoScript}
    </script>
  </body>
</html>`

  const demoPageResponse = demoPageHtml.replace('</script>', '<\\/script>')

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
        const stats = typeof store.stats === 'function' ? store.stats() : null
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            ok: true,
            uptime: process.uptime(),
            entries: stats?.count,
            dropped: stats?.dropped,
            bufferSize: stats?.size
          })
        )
        return
      }

      if (req.method === 'GET' && req.url === '/meta') {
        const stats = typeof store.stats === 'function' ? store.stats() : null
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            version: meta.version,
            buildNumber: meta.buildNumber,
            startedAt: meta.startedAt,
            dashboardDir: config.dashboardDir,
            bufferSize: config.bufferSize,
            stats
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

      if (req.method === 'GET' && req.url === '/demo') {
        const demoPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../demo.html')
        try {
          const demoHtml = fs.readFileSync(demoPath, 'utf-8')
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(demoHtml)
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end('Demo page not found')
        }
        return
      }

      if (serveStatic(req, res, config.dashboardDir)) {
        return
      }

      if (req.method === 'GET' && req.url === '/') {
        const stats = typeof store.stats === 'function' ? store.stats() : null
        const startedText = meta.startedAt ? new Date(meta.startedAt).toLocaleString() : 'unknown'
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
      .meta { margin-top: 1rem; font-size: 0.9rem; color: #444; }
    </style>
  </head>
  <body>
    <h1>MCP Logger</h1>
    <p>Server is running.</p>
    <p class="meta">
      Version v${meta.version ?? 'unknown'} build #${meta.buildNumber ?? 'n/a'} &bull;
      Started ${startedText} &bull; Buffer size ${config.bufferSize}
      ${stats?.count != null ? `&bull; Entries ${stats.count}` : ''}
    </p>
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
