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

function createWebSocket(onEvent, onStatus, onTerminate) {
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
    if (typeof onTerminate === 'function') {
      onTerminate()
    }
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
  let activeControl = {
    send() {
      return false
    },
    dispose() {}
  }
  let disposed = false
  let reconnectDelay = 1000
  let reconnectTimer = null

  function clearReconnect() {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function scheduleReconnect() {
    if (disposed || reconnectTimer) {
      return
    }
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      reconnectDelay = Math.min(reconnectDelay * 2, 30000)
      attemptWebSocket()
    }, reconnectDelay)
  }

  function handleStatus(status) {
    if (status && status.transport === 'websocket') {
      reconnectDelay = status.ready ? 1000 : reconnectDelay
    }
    notifyStatus(onStatus, status)
  }

  function attemptWebSocket() {
    if (disposed) {
      return
    }
    const control = createWebSocket(onEvent, handleStatus, () => {
      clearReconnect()
      scheduleReconnect()
    })
    if (control) {
      activeControl = control
      return
    }
    // WebSocket unsupported; fall back once to SSE
    const sseControl = createEventSource(onEvent, onStatus)
    if (sseControl) {
      activeControl = sseControl
    }
  }

  attemptWebSocket()

  return {
    send(message) {
      return activeControl.send(message)
    },
    dispose() {
      disposed = true
      clearReconnect()
      if (activeControl && typeof activeControl.dispose === 'function') {
        activeControl.dispose()
      }
    }
  }
}
