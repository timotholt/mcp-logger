export function registerClearLogsTool(server, store) {
  server.tool('logging/clear', async ({ params }) => {
    const session = store.clear(params?.label || 'session')
    return { success: true, session }
  })
}
