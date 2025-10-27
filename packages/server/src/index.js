import path from 'path'
import { fileURLToPath } from 'url'
import { loadConfig } from './config.js'
import { LogStore } from './store.js'
import { Broadcaster } from './broadcaster.js'
import { createStdioTransport } from './transports/stdio.js'
import { createHttpTransport } from './transports/http.js'

export async function startServer() {
  const config = loadConfig()
  const store = new LogStore({ size: config.bufferSize })
  const broadcaster = new Broadcaster()

  console.log('[mcp-logger] Starting server')
  console.log(`  buffer size: ${config.bufferSize}`)
  if (config.httpPort) {
    console.log(
      `  http transport: enabled (host=${config.httpHost || '0.0.0.0'} port=${config.httpPort})`
    )
  } else {
    console.log('  http transport: disabled (set LOG_HTTP_PORT to enable dashboard/http APIs)')
  }

  const stdio = createStdioTransport({ store, broadcaster })
  const http = createHttpTransport({ config, store, broadcaster })

  await Promise.all([stdio.start(), http.start()])

  function shutdown() {
    Promise.all([stdio.stop(), http.stop()])
      .catch(() => {})
      .finally(() => process.exit(0))
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return { store, broadcaster, config }
}

const modulePath = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  startServer().catch((err) => {
    console.error('[mcp-logger] Failed to start server', err)
    process.exit(1)
  })
}
