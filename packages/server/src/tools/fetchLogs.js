export function registerFetchLogsTool(server, store) {
  server.tool('logging/fetch', async ({ params }) => {
    const cursor = params?.cursor
    const limit = params?.limit || 100
    const result = store.read({
      cursor,
      limit,
      filterOptions: {
        levels: params?.levels,
        clientId: params?.clientId,
        sessionId: params?.sessionId,
        since: params?.since
      }
    })
    return result
  })
}
