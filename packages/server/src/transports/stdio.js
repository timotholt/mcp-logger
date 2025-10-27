import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  validateLogPayload,
  normalizeTimestamp,
  validateFetchOptions
} from '@mcp-logger/shared'

export function createStdioTransport({ store, broadcaster }) {
  const server = new McpServer({ name: 'mcp-logger', version: '0.1.0' })

  let started = false
  let transport = null

  server.registerTool(
    'logging/push',
    {
      title: 'Push Log Entry',
      description: 'Append a structured log entry to the buffer',
      inputSchema: z.object({}).passthrough()
    },
    async (payload) => {
      const entry = validateLogPayload(payload)
      entry.timestamp = normalizeTimestamp(entry.timestamp)
      const stored = store.append(entry)
      return {
        content: [{ type: 'text', text: 'Log entry stored.' }],
        structuredContent: { success: true, entry: stored }
      }
    }
  )

  server.registerTool(
    'logging/fetch',
    {
      title: 'Fetch Logs',
      description: 'Fetch log entries with optional filtering',
      inputSchema: z
        .object({
          cursor: z.number().optional(),
          limit: z.number().optional(),
          levels: z.array(z.string()).optional(),
          clientId: z.string().optional(),
          sessionId: z.string().optional(),
          since: z.union([z.string(), z.number()]).optional()
        })
        .partial()
    },
    async (params) => {
      const options = validateFetchOptions(params)
      const result = store.read({
        cursor: options.cursor,
        limit: options.limit,
        filterOptions: {
          levels: options.levels,
          clientId: options.clientId,
          sessionId: options.sessionId,
          since: options.since
        }
      })
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, ...result })
          }
        ],
        structuredContent: { success: true, ...result }
      }
    }
  )

  server.registerTool(
    'logging/clear',
    {
      title: 'Clear Logs',
      description: 'Clear the log buffer and start a new session',
      inputSchema: z.object({ label: z.string().optional() }).partial()
    },
    async ({ label }) => {
      const session = store.clear(label || 'session')
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, session })
          }
        ],
        structuredContent: { success: true, session }
      }
    }
  )

  server.registerTool(
    'logging/set-session',
    {
      title: 'Set Session',
      description: 'Update the active session label',
      inputSchema: z.object({ label: z.string() })
    },
    async ({ label }) => {
      const session = store.startSession(label)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, session })
          }
        ],
        structuredContent: { success: true, session }
      }
    }
  )

  broadcaster.on('append', (entry) => {
    server.server.sendLoggingMessage({ level: entry.level, data: entry })
  })

  broadcaster.on('clear', (session) => {
    server.server.sendLoggingMessage({
      level: 'info',
      data: { event: 'clear', session }
    })
  })

  broadcaster.on('session', (session) => {
    server.server.sendLoggingMessage({
      level: 'info',
      data: { event: 'session', session }
    })
  })

  async function start() {
    if (started) return
    started = true

    transport = new StdioServerTransport()
    await server.connect(transport)
    console.log('[mcp-logger] stdio transport listening')
  }

  async function stop() {
    if (!started) return
    started = false
    await server.close()
    if (transport) {
      await transport.close()
      transport = null
    }
  }

  return { start, stop, server }
}
