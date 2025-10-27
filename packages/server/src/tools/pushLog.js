import { validateLogPayload, normalizeTimestamp } from '@mcp-logger/shared'

export function registerPushLogTool(server, store) {
  server.tool('logging/push', async ({ params }) => {
    const payload = validateLogPayload(params)
    payload.timestamp = normalizeTimestamp(payload.timestamp)
    const entry = store.append(payload)
    return { success: true, entry }
  })
}
