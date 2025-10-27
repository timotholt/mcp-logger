import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { registerPushLogTool } from '../tools/pushLog.js'
import { registerFetchLogsTool } from '../tools/fetchLogs.js'
import { registerClearLogsTool } from '../tools/clearLogs.js'
import { registerSetSessionTool } from '../tools/setSession.js'

export function createStdioTransport({ store, broadcaster }) {
  const server = new Server({ name: 'mcp-logger' })

  let started = false

  async function start() {
    if (started) return
    started = true

    registerPushLogTool(server, store)
    registerFetchLogsTool(server, store)
    registerClearLogsTool(server, store)
    registerSetSessionTool(server, store)

    broadcaster.on('append', (entry) => {
      server.logging({ level: entry.level, data: entry })
    })

    broadcaster.on('clear', (session) => {
      server.logging({ level: 'info', data: { event: 'clear', session } })
    })

    broadcaster.on('session', (session) => {
      server.logging({ level: 'info', data: { event: 'session', session } })
    })

    await server.run()
  }

  async function stop() {
    if (!started) return
    started = false
    await server.close()
  }

  return { start, stop, server }
}
