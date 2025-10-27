export function registerSetSessionTool(server, store) {
  server.tool('logging/set-session', async ({ params }) => {
    const session = store.startSession(params?.label || 'session')
    return { success: true, session }
  })
}
