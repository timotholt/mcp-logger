'use strict'

function supportsWebSocket() {
  return typeof window !== 'undefined' && typeof window.WebSocket === 'function'
}

export function createWebSocketTransport(options) {
  if (!supportsWebSocket()) {
    return {
      connect: function () {
        return Promise.resolve({ ready: false })
      },
      sendBatch: function () {
        return Promise.resolve()
      },
      close: function () {}
    }
  }

  var url = options.url
  var socket = null
  var queue = []
  var ready = false

  function flushQueue() {
    if (!ready || !socket || socket.readyState !== 1) {
      return
    }
    while (queue.length) {
      var payload = queue.shift()
      socket.send(JSON.stringify(payload))
    }
  }

  function connect() {
    return new Promise(function (resolve) {
      socket = new window.WebSocket(url)
      socket.onopen = function () {
        ready = true
        flushQueue()
        resolve({ ready: true })
      }
      socket.onclose = function () {
        ready = false
      }
      socket.onerror = function () {
        ready = false
      }
    })
  }

  function sendBatch(batch) {
    if (!batch || !batch.length) {
      return Promise.resolve()
    }
    queue.push({ type: 'batch', entries: batch })
    flushQueue()
    return Promise.resolve()
  }

  function close() {
    if (socket) {
      socket.close()
      socket = null
    }
  }

  return {
    connect: connect,
    sendBatch: sendBatch,
    close: close
  }
}
