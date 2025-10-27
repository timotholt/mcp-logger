import { loadConfig } from './config.js'
import { LogStore } from './store.js'
import { Broadcaster } from './broadcaster.js'
import { createStdioTransport } from './transports/stdio.js'
import { createHttpTransport } from './transports/http.js'

export async function startServer() {
  const config = loadConfig()
  const store = new LogStore({ size: config.bufferSize })
  const broadcaster = new Broadcaster()

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

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err) => {
    console.error('[mcp-logger] Failed to start server', err)
    process.exit(1)
  })
}
