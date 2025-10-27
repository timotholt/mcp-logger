import { Server } from '@modelcontextprotocol/sdk/server/index.js'

export function createStdioTransport({ store, broadcaster }) {
  const server = new Server({ name: 'mcp-logger' })

  let started = false

  async function start() {
    if (started) return
    started = true

    server.tool('logging/push', async ({ params }) => {
      const stored = store.append(params || {})
      return { success: true, entry: stored }
    })

    server.tool('logging/fetch', async ({ params }) => {
      const { entries, nextCursor } = store.read({
        cursor: params?.cursor,
        limit: params?.limit || 100,
        filterOptions: {
          levels: params?.levels,
          clientId: params?.clientId,
          sessionId: params?.sessionId,
          since: params?.since
        }
      })
      return { entries, nextCursor }
    })

    server.tool('logging/clear', async () => {
      const session = store.clear()
      return { success: true, session }
    })

    server.tool('logging/set-session', async ({ params }) => {
      const session = store.startSession(params?.label || 'session')
      return { session }
    })

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
