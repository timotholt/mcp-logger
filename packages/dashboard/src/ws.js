const WS_PATH = '/ws'

function notifyStatus(callback, status) {
  if (typeof callback === 'function') {
    callback(status)
  }
}

function createEventSource(onEvent, onStatus) {
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
  notifyStatus(onStatus, { transport: 'sse', ready: true })
  return {
    send() {
      return false
    },
    dispose() {
      source.close()
    }
  }
}

function createWebSocket(onEvent, onStatus) {
  if (typeof WebSocket !== 'function') {
    return null
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const socket = new WebSocket(protocol + '//' + window.location.host + WS_PATH)
  let isReady = false

  function updateStatus() {
    notifyStatus(onStatus, { transport: 'websocket', ready: isReady })
  }

  socket.onopen = function () {
    isReady = true
    updateStatus()
  }

  socket.onclose = function () {
    isReady = false
    updateStatus()
  }

  socket.onerror = function () {
    socket.close()
  }

  socket.onmessage = function (event) {
    try {
      onEvent(JSON.parse(event.data))
    } catch (err) {
      // ignore
    }
  }

  return {
    send(message) {
      if (!isReady || socket.readyState !== WebSocket.OPEN) {
        return false
      }
      try {
        socket.send(JSON.stringify(message))
        return true
      } catch (err) {
        return false
      }
    },
    dispose() {
      socket.close()
    }
  }
}

export function startLogStream(onEvent, onStatus) {
  const wsControl = createWebSocket(onEvent, onStatus)
  if (wsControl) {
    return wsControl
  }
  const sseControl = createEventSource(onEvent, onStatus)
  if (sseControl) {
    return sseControl
  }
  return {
    send() {
      return false
    },
    dispose() {}
  }
}
