import path from 'path'
import { fileURLToPath } from 'url'
import { configMetadata, loadConfig } from './config.js'
import { LogStore } from './store.js'
import { Broadcaster } from './broadcaster.js'
import { createStdioTransport } from './transports/stdio.js'
import { createHttpTransport } from './transports/http.js'

export async function startServer() {
  const config = loadConfig()
  const store = new LogStore({ size: config.bufferSize })
  const broadcaster = new Broadcaster()
  const startedAt = new Date().toISOString()

  store.on('append', (entry) => broadcaster.emit('append', entry))
  store.on('clear', (session) => broadcaster.emit('clear', session))
  store.on('session', (session) => broadcaster.emit('session', session))

  console.log('[mcp-logger] Starting server')
  console.log(
    `  env file (${configMetadata.envFileLoaded ? 'loaded' : 'missing'}): ${configMetadata.envFilePath}`
  )
  console.log(`  buffer size: ${config.bufferSize}`)
  console.log(`  version: v${config.version} build #${config.buildNumber}`)
  console.log(`  started at: ${new Date(startedAt).toLocaleString()}`)
  if (config.httpPort) {
    console.log(
      `  http transport: enabled (host=${config.httpHost || '0.0.0.0'} port=${config.httpPort})`
    )
    const host = config.httpHost === '0.0.0.0' ? 'localhost' : config.httpHost
    if (config.dashboardDir) {
      const configuredAs =
        config.raw?.dashboardDir && config.raw.dashboardDir !== config.dashboardDir
          ? ` (configured as ${config.raw.dashboardDir})`
          : ''
      console.log(
        `  dashboard: http://${host}:${config.httpPort}/ (serve dir: ${config.dashboardDir}${configuredAs})`
      )
    } else {
      console.log('  dashboard: disabled (set LOG_DASHBOARD_DIR to serve UI assets)')
    }
  } else {
    console.log('  http transport: disabled (set LOG_HTTP_PORT to enable dashboard/http APIs)')
  }

  const stdio = createStdioTransport({ store, broadcaster })
  const http = createHttpTransport({
    config,
    store,
    broadcaster,
    meta: {
      version: config.version,
      buildNumber: config.buildNumber,
      startedAt
    }
  })

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
