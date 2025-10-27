const WS_PATH = '/ws'

function createEventSource(onEvent) {
  if (typeof EventSource !== 'function') {
    return null
  }
  const source = new EventSource('/events')
  source.onmessage = function (event) {
    try {
      onEvent(JSON.parse(event.data))
    } catch (err) {
      // ignore
    }
  }
  return source
}

function createWebSocket(onEvent) {
  if (typeof WebSocket !== 'function') {
    return null
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const socket = new WebSocket(protocol + '//' + window.location.host + WS_PATH)
  socket.onmessage = function (event) {
    try {
      onEvent(JSON.parse(event.data))
    } catch (err) {
      // ignore
    }
  }
  return socket
}

export function startLogStream(onEvent) {
  const socket = createWebSocket(onEvent)
  if (!socket) {
    createEventSource(onEvent)
  }
}
